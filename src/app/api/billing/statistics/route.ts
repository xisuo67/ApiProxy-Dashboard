import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, balance: true }
    });

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    // 获取当前月份的开始和结束时间
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // 本月充值总额：当月所有支付成功的订单金额总和
    const monthlyRechargeResult = await prisma.rechargeOrder.aggregate({
      where: {
        userId: user.id,
        status: 'succeeded',
        paidAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      },
      _sum: {
        amount: true
      }
    });

    // 累计消费：所有支付成功的订单金额总和
    const totalRechargeResult = await prisma.rechargeOrder.aggregate({
      where: {
        userId: user.id,
        status: 'succeeded'
      },
      _sum: {
        amount: true
      }
    });

    const currentBalance = Number(user.balance);
    const monthlyRechargeTotal = Number(monthlyRechargeResult._sum.amount || 0);
    const totalRecharge = Number(totalRechargeResult._sum.amount || 0);

    return NextResponse.json(
      {
        currentBalance,
        monthlyRechargeTotal,
        totalRecharge
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[BILLING_STATISTICS_ERROR]', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { message: '获取统计数据失败，请稍后重试' },
      { status: 500 }
    );
  }
}
