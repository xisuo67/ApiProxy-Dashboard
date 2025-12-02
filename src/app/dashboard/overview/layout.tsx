import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// 获取账户余额和今日累计消费
async function getBalanceData(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { balance: true }
    });

    if (!user) {
      return { balance: 0, todayCost: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCostResult = await prisma.apiRequestLog.aggregate({
      where: {
        userClerkId: userId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        cost: true
      }
    });

    return {
      balance: Number(user.balance),
      todayCost: Number(todayCostResult._sum.cost || 0)
    };
  } catch (error) {
    console.error('[GET_BALANCE_DATA_ERROR]', error);
    return { balance: 0, todayCost: 0 };
  }
}

// 获取本月充值金额
async function getMonthlyRechargeData(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return { currentMonthAmount: 0, changeRate: 0 };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999
    );
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(
      currentYear,
      currentMonth,
      0,
      23,
      59,
      59,
      999
    );

    const [currentMonthResult, lastMonthResult] = await Promise.all([
      prisma.rechargeOrder.aggregate({
        where: {
          userId: user.id,
          status: 'succeeded',
          paidAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd
          }
        },
        _sum: { amount: true }
      }),
      prisma.rechargeOrder.aggregate({
        where: {
          userId: user.id,
          status: 'succeeded',
          paidAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        },
        _sum: { amount: true }
      })
    ]);

    const currentMonthAmount = Number(currentMonthResult._sum.amount || 0);
    const lastMonthAmount = Number(lastMonthResult._sum.amount || 0);

    let changeRate = 0;
    if (lastMonthAmount > 0) {
      changeRate =
        ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100;
    } else if (currentMonthAmount > 0) {
      changeRate = 100;
    }

    return {
      currentMonthAmount,
      changeRate: Number(changeRate.toFixed(2))
    };
  } catch (error) {
    console.error('[GET_MONTHLY_RECHARGE_DATA_ERROR]', error);
    return { currentMonthAmount: 0, changeRate: 0 };
  }
}

// 获取本月接口调用次数
async function getMonthlyApiCallsData(userId: string) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999
    );
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(
      currentYear,
      currentMonth,
      0,
      23,
      59,
      59,
      999
    );

    const [currentMonthCount, lastMonthCount] = await Promise.all([
      prisma.apiRequestLog.count({
        where: {
          userClerkId: userId,
          createdAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd
          }
        }
      }),
      prisma.apiRequestLog.count({
        where: {
          userClerkId: userId,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      })
    ]);

    let changeRate = 0;
    if (lastMonthCount > 0) {
      changeRate =
        ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
    } else if (currentMonthCount > 0) {
      changeRate = 100;
    }

    return {
      currentMonthCount,
      changeRate: Number(changeRate.toFixed(2))
    };
  } catch (error) {
    console.error('[GET_MONTHLY_API_CALLS_DATA_ERROR]', error);
    return { currentMonthCount: 0, changeRate: 0 };
  }
}

// 获取当日接口调用次数
async function getDailyApiCallsData(userId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 前一日开始和结束时间
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [dailyCount, yesterdayCount] = await Promise.all([
      prisma.apiRequestLog.count({
        where: {
          userClerkId: userId,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      prisma.apiRequestLog.count({
        where: {
          userClerkId: userId,
          createdAt: {
            gte: yesterday,
            lt: today
          }
        }
      })
    ]);

    // 计算环比
    let changeRate = 0;
    if (yesterdayCount > 0) {
      changeRate = ((dailyCount - yesterdayCount) / yesterdayCount) * 100;
    } else if (dailyCount > 0) {
      changeRate = 100; // 前一日为0，今日有数据，增长100%
    }

    return {
      dailyCount,
      yesterdayCount,
      changeRate: Number(changeRate.toFixed(2))
    };
  } catch (error) {
    console.error('[GET_DAILY_API_CALLS_DATA_ERROR]', error);
    return { dailyCount: 0, yesterdayCount: 0, changeRate: 0 };
  }
}

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // 并行获取所有统计数据
  const [
    balanceData,
    monthlyRechargeData,
    monthlyApiCallsData,
    dailyApiCallsData
  ] = await Promise.all([
    getBalanceData(userId),
    getMonthlyRechargeData(userId),
    getMonthlyApiCallsData(userId),
    getDailyApiCallsData(userId)
  ]);
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>Hi, 欢迎回来 👋</h2>
        </div>

        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
          {/* 账户余额 */}
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>账户余额</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                ¥{balanceData.balance.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                今日累计消费：¥{balanceData.todayCost.toFixed(2)}
              </div>
              <div className='text-muted-foreground'>感谢你的支持</div>
            </CardFooter>
          </Card>

          {/* 本月充值金额 */}
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>本月充值金额</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                ¥{monthlyRechargeData.currentMonthAmount.toFixed(2)}
              </CardTitle>
              {monthlyRechargeData.changeRate !== 0 && (
                <CardAction>
                  <Badge variant='outline'>
                    {monthlyRechargeData.changeRate > 0 ? (
                      <IconTrendingUp />
                    ) : (
                      <IconTrendingDown />
                    )}
                    {monthlyRechargeData.changeRate > 0 ? '+' : ''}
                    {monthlyRechargeData.changeRate.toFixed(2)}%
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              {monthlyRechargeData.changeRate !== 0 && (
                <div className='line-clamp-1 flex gap-2 font-medium'>
                  {monthlyRechargeData.changeRate > 0
                    ? '环比上月增加'
                    : '环比上月减少'}{' '}
                  {Math.abs(monthlyRechargeData.changeRate).toFixed(2)}%{' '}
                  {monthlyRechargeData.changeRate > 0 ? (
                    <IconTrendingUp className='size-4' />
                  ) : (
                    <IconTrendingDown className='size-4' />
                  )}
                </div>
              )}
              <div className='text-muted-foreground'>
                {monthlyRechargeData.changeRate > 0
                  ? '恭喜您业务稳定增长，继续加油！'
                  : monthlyRechargeData.changeRate < 0
                    ? '您的数据有所下降，请及时关注'
                    : '保持稳定'}
              </div>
            </CardFooter>
          </Card>

          {/* 本月接口调用次数 */}
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>本月接口调用次数</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {monthlyApiCallsData.currentMonthCount.toLocaleString()}
              </CardTitle>
              {monthlyApiCallsData.changeRate !== 0 && (
                <CardAction>
                  <Badge variant='outline'>
                    {monthlyApiCallsData.changeRate > 0 ? (
                      <IconTrendingUp />
                    ) : (
                      <IconTrendingDown />
                    )}
                    {monthlyApiCallsData.changeRate > 0 ? '+' : ''}
                    {monthlyApiCallsData.changeRate.toFixed(2)}%
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              {monthlyApiCallsData.changeRate !== 0 && (
                <div className='line-clamp-1 flex gap-2 font-medium'>
                  {monthlyApiCallsData.changeRate > 0
                    ? '环比上月增加'
                    : '环比上月减少'}{' '}
                  {Math.abs(monthlyApiCallsData.changeRate).toFixed(2)}%{' '}
                  {monthlyApiCallsData.changeRate > 0 ? (
                    <IconTrendingUp className='size-4' />
                  ) : (
                    <IconTrendingDown className='size-4' />
                  )}
                </div>
              )}
              <div className='text-muted-foreground'>
                {monthlyApiCallsData.changeRate > 0
                  ? '您的业务正在稳定增长，继续保持！'
                  : monthlyApiCallsData.changeRate < 0
                    ? '您的业务数据下降，需要关注'
                    : '保持稳定'}
              </div>
            </CardFooter>
          </Card>

          {/* 当日接口调用次数 */}
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>当日接口调用次数</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {dailyApiCallsData.dailyCount.toLocaleString()}
              </CardTitle>
              {dailyApiCallsData.changeRate !== 0 && (
                <CardAction>
                  <Badge variant='outline'>
                    {dailyApiCallsData.changeRate > 0 ? (
                      <IconTrendingUp />
                    ) : (
                      <IconTrendingDown />
                    )}
                    {dailyApiCallsData.changeRate > 0 ? '+' : ''}
                    {dailyApiCallsData.changeRate.toFixed(2)}%
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              {dailyApiCallsData.changeRate !== 0 && (
                <div className='line-clamp-1 flex gap-2 font-medium'>
                  {dailyApiCallsData.changeRate > 0
                    ? '环比昨日增加'
                    : '环比昨日减少'}{' '}
                  {Math.abs(dailyApiCallsData.changeRate).toFixed(2)}%{' '}
                  {dailyApiCallsData.changeRate > 0 ? (
                    <IconTrendingUp className='size-4' />
                  ) : (
                    <IconTrendingDown className='size-4' />
                  )}
                </div>
              )}
              <div className='text-muted-foreground'>
                {dailyApiCallsData.changeRate > 0
                  ? '您的业务数据稳定增长，继续保持！'
                  : dailyApiCallsData.changeRate < 0
                    ? '您的业务数据有所下降，请及时关注'
                    : '实时数据更新'}
              </div>
            </CardFooter>
          </Card>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>
            {/* sales arallel routes */}
            {sales}
          </div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div>
      </div>
    </PageContainer>
  );
}
