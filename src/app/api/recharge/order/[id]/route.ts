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
