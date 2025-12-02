import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * 查询订单详情
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const params = await context.params;
    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json({ message: '订单ID不能为空' }, { status: 400 });
    }

    // 查询订单
    const order = await prisma.rechargeOrder.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        user: {
          select: {
            clerkId: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ message: '订单不存在' }, { status: 404 });
    }

    // 验证订单是否属于当前用户
    if (order.user.clerkId !== userId) {
      return NextResponse.json(
        { message: '无权限访问此订单' },
        { status: 403 }
      );
    }

    // 返回订单信息
    return NextResponse.json(
      {
        id: order.id.toString(),
        amount: order.amount.toString(),
        currency: order.currency,
        provider: order.provider,
        payMethod: order.payMethod,
        status: order.status,
        providerOrderId: order.providerOrderId,
        providerSessionId: order.providerSessionId,
        paidAt: order.paidAt?.toISOString() || null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[RECHARGE_ORDER_GET_ERROR]', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      { message: '查询订单失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 删除订单（仅允许删除待支付状态的订单）
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let userId: string | null = null;
  let orderId: string | null = null;

  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const params = await context.params;
    orderId = params.id;

    if (!orderId) {
      return NextResponse.json({ message: '订单ID不能为空' }, { status: 400 });
    }

    // 查询订单
    const order = await prisma.rechargeOrder.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        user: {
          select: {
            clerkId: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ message: '订单不存在' }, { status: 404 });
    }

    // 验证订单是否属于当前用户
    if (order.user.clerkId !== clerkUserId) {
      return NextResponse.json(
        { message: '无权限操作此订单' },
        { status: 403 }
      );
    }

    // 只允许删除待支付状态的订单
    if (order.status !== 'pending') {
      return NextResponse.json(
        { message: '只能删除待支付状态的订单' },
        { status: 400 }
      );
    }

    // 删除订单
    await prisma.rechargeOrder.delete({
      where: { id: BigInt(orderId) }
    });

    return NextResponse.json({ message: '删除成功' }, { status: 200 });
  } catch (error: any) {
    console.error('[RECHARGE_ORDER_DELETE_ERROR]', {
      orderId: orderId ?? 'unknown',
      userId,
      error: error.message,
      stack: error.stack
    });

    const userMessage =
      error.message?.includes('不存在') ||
      error.message?.includes('无权限') ||
      error.message?.includes('只能删除')
        ? error.message
        : '删除订单失败，请稍后重试';

    return NextResponse.json({ message: userMessage }, { status: 500 });
  }
}
