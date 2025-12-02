import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

/**
 * 从 settings 表获取 Stripe 配置
 */
async function getStripeConfig(): Promise<{
  secretKey: string;
  webhookSecret: string;
}> {
  const [privateKeySetting, webhookSecretSetting] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: 'StripeApiPrivateKey' }
    }),
    prisma.setting.findUnique({
      where: { key: 'StripeWebhookSecret' }
    })
  ]);

  const secretKey = privateKeySetting?.value;
  const webhookSecret = webhookSecretSetting?.value;

  if (!secretKey) {
    console.error('[STRIPE_WEBHOOK] StripeApiPrivateKey 未配置');
    throw new Error(
      'Stripe 私钥未配置，请在系统设置中配置 StripeApiPrivateKey'
    );
  }

  if (!webhookSecret) {
    console.error('[STRIPE_WEBHOOK] StripeWebhookSecret 未配置');
    throw new Error(
      'Stripe Webhook 签名密钥未配置，请在系统设置中配置 StripeWebhookSecret'
    );
  }

  return { secretKey, webhookSecret };
}

/**
 * Stripe Webhook 处理
 *
 * 处理的事件：
 * - checkout.session.completed: Checkout 支付成功
 * - payment_intent.succeeded: 支付意图成功（备用）
 */
export async function POST(req: NextRequest) {
  // 从 settings 表获取配置
  let stripeConfig;
  try {
    stripeConfig = await getStripeConfig();
  } catch (error: any) {
    console.error('[STRIPE_WEBHOOK] Config error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Stripe 配置错误' },
      { status: 500 }
    );
  }

  // 初始化 Stripe 客户端
  const stripe = new Stripe(stripeConfig.secretKey, {
    apiVersion: '2025-11-17.clover'
  });

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('[STRIPE_WEBHOOK] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // 验证 webhook 签名
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (error: any) {
    console.error(
      '[STRIPE_WEBHOOK] Signature verification failed:',
      error.message
    );
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // 处理不同的事件类型
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        stripe
      );
    } else if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
        stripe
      );
    } else {
      console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[STRIPE_WEBHOOK] Error processing webhook:', {
      type: event.type,
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 }
    );
  }
}

/**
 * 处理 checkout.session.completed 事件
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
) {
  const sessionId = session.id;
  const paymentIntentId = session.payment_intent as string | null;
  const amount = session.amount_total ? session.amount_total / 100 : 0; // Stripe 金额以分为单位，转换为元
  const currency = session.currency?.toUpperCase() || 'CNY';
  const customerId = session.customer as string | null;

  // 从 payment_intent 获取实际的支付方式
  let paymentMethod: string | null = null;
  if (paymentIntentId) {
    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);
      // 获取支付方式类型
      if (paymentIntent.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
          paymentIntent.payment_method as string
        );
        // 获取实际的支付方式类型
        if (pm.type === 'card') {
          paymentMethod = 'card';
        } else if (pm.type === 'alipay') {
          paymentMethod = 'alipay';
        } else {
          paymentMethod = pm.type || null;
        }
      }
    } catch (error) {
      console.error(
        '[STRIPE_WEBHOOK] Failed to retrieve payment method:',
        error
      );
      // 如果获取失败，使用 session 中的 payment_method_types 作为备选
      paymentMethod = session.payment_method_types?.[0] || null;
    }
  } else {
    // 如果没有 payment_intent，使用 session 中的 payment_method_types
    paymentMethod = session.payment_method_types?.[0] || null;
  }

  console.log('[STRIPE_WEBHOOK] Processing checkout.session.completed', {
    sessionId,
    paymentIntentId,
    amount,
    currency,
    customerId
  });

  // 通过 sessionId 查找订单
  const order = await prisma.rechargeOrder.findFirst({
    where: {
      providerSessionId: sessionId,
      status: { in: ['pending', 'processing'] }
    },
    include: {
      user: true
    }
  });

  if (!order) {
    console.warn('[STRIPE_WEBHOOK] Order not found for session:', sessionId);
    return;
  }

  // 检查订单是否已经处理过（防止重复处理）
  if (order.status === 'succeeded') {
    console.log(
      '[STRIPE_WEBHOOK] Order already processed:',
      order.id.toString()
    );
    return;
  }

  // 使用事务更新订单状态和用户余额（使用行锁防止并发问题）
  await prisma.$transaction(
    async (tx) => {
      // 锁定用户行并获取当前余额（防止并发更新）
      const userWithLock = (await (tx as any).$queryRawUnsafe(
        `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
        order.userId
      )) as Array<{ id: bigint; balance: any }>;

      if (!userWithLock || userWithLock.length === 0) {
        throw new Error('用户不存在');
      }

      // 更新订单状态
      await tx.rechargeOrder.update({
        where: { id: order.id },
        data: {
          status: 'succeeded',
          providerOrderId: paymentIntentId || sessionId,
          payMethod: paymentMethod || undefined,
          providerRawPayload: JSON.stringify(session),
          paidAt: new Date()
        }
      });

      // 增加用户余额（使用行锁后的安全更新）
      await tx.user.update({
        where: { id: order.userId },
        data: {
          balance: {
            increment: order.amount
          }
        }
      });
    },
    {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted'
    }
  );

  console.log('[STRIPE_WEBHOOK] Order processed successfully', {
    orderId: order.id.toString(),
    userId: order.userId.toString(),
    amount: order.amount.toString()
  });
}

/**
 * 处理 payment_intent.succeeded 事件（备用，用于直接支付场景）
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  stripe: Stripe
) {
  const paymentIntentId = paymentIntent.id;
  const amount = paymentIntent.amount / 100; // Stripe 金额以分为单位，转换为元
  const currency = paymentIntent.currency?.toUpperCase() || 'CNY';

  // 从 payment_intent 获取实际的支付方式
  let paymentMethod: string | null = null;
  if (paymentIntent.payment_method) {
    try {
      const pm = await stripe.paymentMethods.retrieve(
        paymentIntent.payment_method as string
      );
      // 获取实际的支付方式类型
      if (pm.type === 'card') {
        paymentMethod = 'card';
      } else if (pm.type === 'alipay') {
        paymentMethod = 'alipay';
      } else {
        paymentMethod = pm.type || null;
      }
    } catch (error) {
      console.error(
        '[STRIPE_WEBHOOK] Failed to retrieve payment method:',
        error
      );
      paymentMethod = null;
    }
  }

  console.log('[STRIPE_WEBHOOK] Processing payment_intent.succeeded', {
    paymentIntentId,
    amount,
    currency,
    paymentMethod
  });

  // 通过 paymentIntentId 查找订单
  const order = await prisma.rechargeOrder.findFirst({
    where: {
      providerOrderId: paymentIntentId,
      status: { in: ['pending', 'processing'] }
    },
    include: {
      user: true
    }
  });

  if (!order) {
    console.warn(
      '[STRIPE_WEBHOOK] Order not found for payment_intent:',
      paymentIntentId
    );
    return;
  }

  // 检查订单是否已经处理过
  if (order.status === 'succeeded') {
    console.log(
      '[STRIPE_WEBHOOK] Order already processed:',
      order.id.toString()
    );
    return;
  }

  // 使用事务更新订单状态和用户余额（使用行锁防止并发问题）
  await prisma.$transaction(
    async (tx) => {
      // 锁定用户行并获取当前余额（防止并发更新）
      const userWithLock = (await (tx as any).$queryRawUnsafe(
        `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
        order.userId
      )) as Array<{ id: bigint; balance: any }>;

      if (!userWithLock || userWithLock.length === 0) {
        throw new Error('用户不存在');
      }

      // 更新订单状态
      await tx.rechargeOrder.update({
        where: { id: order.id },
        data: {
          status: 'succeeded',
          payMethod: paymentMethod || undefined,
          providerRawPayload: JSON.stringify(paymentIntent),
          paidAt: new Date()
        }
      });

      // 增加用户余额（使用行锁后的安全更新）
      await tx.user.update({
        where: { id: order.userId },
        data: {
          balance: {
            increment: order.amount
          }
        }
      });
    },
    {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted'
    }
  );

  console.log('[STRIPE_WEBHOOK] Order processed successfully', {
    orderId: order.id.toString(),
    userId: order.userId.toString(),
    amount: order.amount.toString()
  });
}
