import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/apisix';
import { generateIdBigInt } from '@/lib/snowflake';
import Stripe from 'stripe';

const MIN_RECHARGE_AMOUNT = 10; // 最低充值金额（元）

/**
 * 从 settings 表获取 Stripe 配置
 */
async function getStripeConfig(): Promise<{
  secretKey: string;
  publishableKey: string;
}> {
  const [privateKeySetting, publicKeySetting] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: 'StripeApiPrivateKey' }
    }),
    prisma.setting.findUnique({
      where: { key: 'StripeApiPubKey' }
    })
  ]);

  const secretKey = privateKeySetting?.value;
  const publishableKey = publicKeySetting?.value;

  if (!secretKey) {
    throw new Error(
      'Stripe 私钥未配置，请在系统设置中配置 StripeApiPrivateKey'
    );
  }

  if (!publishableKey) {
    throw new Error('Stripe 公钥未配置，请在系统设置中配置 StripeApiPubKey');
  }

  return { secretKey, publishableKey };
}

/**
 * 创建充值订单并返回 Stripe Checkout Session
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户登录
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    // 2. 获取请求参数
    const body = await req.json();
    const { amount } = body as { amount?: number };

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ message: '充值金额无效' }, { status: 400 });
    }

    // 3. 验证最低充值金额
    if (amount < MIN_RECHARGE_AMOUNT) {
      return NextResponse.json(
        { message: `最低充值金额为 ${MIN_RECHARGE_AMOUNT} 元` },
        { status: 400 }
      );
    }

    // 4. 查询用户信息（包含邮箱）
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, clerkId: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    // 5. 获取 Stripe 配置
    const stripeConfig = await getStripeConfig();

    // 6. 初始化 Stripe 客户端
    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2025-11-17.clover'
    });

    // 7. 创建充值订单记录（使用雪花ID）
    const order = await prisma.rechargeOrder.create({
      data: {
        id: generateIdBigInt(),
        userId: user.id,
        amount: amount,
        currency: 'CNY',
        provider: 'stripe',
        status: 'pending'
      }
    });

    // 8. 创建 Stripe Checkout Session
    // baseUrl 用于构建用户支付完成后的重定向地址（不是 webhook 回调地址）
    // Webhook 回调地址需要在 Stripe Dashboard 中配置：https://your-domain.com/api/webhooks/stripe
    const baseUrl = await getAppUrl();
    // 支付成功：跳转到支付结果页面
    const successUrl = `${baseUrl}/paycallback?orderId=${order.id.toString()}`;
    // 用户取消：跳转回充值页面
    const cancelUrl = `${baseUrl}/dashboard/billing?tab=recharge`;

    console.log('[RECHARGE_CREATE_ORDER] Stripe Checkout URLs', {
      baseUrl,
      successUrl,
      cancelUrl,
      orderId: order.id.toString()
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'alipay'], // 支持信用卡和支付宝
      line_items: [
        {
          price_data: {
            currency: 'cny',
            product_data: {
              name: '账户充值',
              description: `为账户充值 ¥${amount.toFixed(2)}`
            },
            unit_amount: Math.round(amount * 100) // Stripe 金额以分为单位
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      // 设置用户邮箱（如果存在），Stripe 会自动预填
      customer_email: user.email || undefined,
      // 支付成功后的重定向地址（跳转到支付回调页面）
      success_url: successUrl,
      // 支付取消后的重定向地址（跳转到支付回调页面）
      cancel_url: cancelUrl,
      client_reference_id: order.id.toString(), // 用于关联订单
      metadata: {
        orderId: order.id.toString(),
        userId: user.id.toString(),
        clerkId: user.clerkId
      }
    });

    // 9. 更新订单的 providerSessionId
    await prisma.rechargeOrder.update({
      where: { id: order.id },
      data: {
        providerSessionId: session.id
      }
    });

    // 10. 返回 Session URL
    return NextResponse.json(
      {
        sessionId: session.id,
        url: session.url,
        orderId: order.id.toString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[RECHARGE_CREATE_ORDER_ERROR]', {
      error: error.message,
      stack: error.stack
    });

    const userMessage =
      error.message?.includes('未配置') || error.message?.includes('无效')
        ? error.message
        : '创建充值订单失败，请稍后重试';

    return NextResponse.json({ message: userMessage }, { status: 500 });
  }
}
