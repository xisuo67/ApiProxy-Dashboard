import { AreaGraph } from '@/features/overview/components/area-graph';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// 获取当月接口调用数据，按日期和服务商分组
async function getMonthlyApiCallsByDay() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
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

    // 获取当月所有接口调用记录
    const logs = await prisma.apiRequestLog.findMany({
      where: {
        userClerkId: userId,
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      },
      select: {
        createdAt: true,
        serviceProvider: true
      }
    });

    // 按日期和服务商分组统计
    const dataMap = new Map<string, Map<string, number>>();

    logs.forEach((log) => {
      const date = new Date(log.createdAt);
      // 使用 YYYY-MM-DD 格式作为 key，确保唯一性
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const provider = log.serviceProvider || '未知';

      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, new Map());
      }

      const providerMap = dataMap.get(dateKey)!;
      providerMap.set(provider, (providerMap.get(provider) || 0) + 1);
    });

    // 获取所有服务商
    const allProviders = new Set<string>();
    dataMap.forEach((providerMap) => {
      providerMap.forEach((_, provider) => {
        allProviders.add(provider);
      });
    });

    // 生成当月所有日期
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const result: Array<Record<string, any>> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData: Record<string, any> = {
        date: `${currentMonth + 1}-${day}` // 显示格式：月-日
      };

      allProviders.forEach((provider) => {
        const count = dataMap.get(dateKey)?.get(provider) || 0;
        // 使用服务商名称作为 key，但需要处理特殊字符
        const safeKey = provider.replace(/[^a-zA-Z0-9]/g, '_');
        dayData[safeKey] = count;
      });

      result.push(dayData);
    }

    return {
      data: result,
      providers: Array.from(allProviders)
    };
  } catch (error) {
    console.error('[GET_MONTHLY_API_CALLS_BY_DAY_ERROR]', error);
    return { data: [], providers: [] };
  }
}

export default async function AreaStats() {
  const { data, providers } = await getMonthlyApiCallsByDay();
  return <AreaGraph data={data} providers={providers} />;
}
