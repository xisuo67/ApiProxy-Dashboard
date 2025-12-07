import { PieGraph } from '@/features/overview/components/pie-graph';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// 获取当日接口调用数据，按服务商分组
async function getDailyApiCallsByProvider(): Promise<
  Array<{ provider: string; count: number }>
> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 获取当日所有接口调用记录
    const logs = await prisma.apiRequestLog.findMany({
      where: {
        userClerkId: userId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        serviceProvider: true
      }
    });

    // 按服务商分组统计（对服务商名称做规范化，避免因为多余空格导致重复）
    const providerMap = new Map<string, number>();
    logs.forEach((log: { serviceProvider: string | null }) => {
      const rawProvider = log.serviceProvider ?? '';
      const normalizedProvider = rawProvider.trim();
      const provider = normalizedProvider || '未知';
      providerMap.set(provider, (providerMap.get(provider) || 0) + 1);
    });

    // 转换为数组格式
    const result = Array.from(providerMap.entries()).map(
      ([provider, count]) => ({
        provider,
        count
      })
    );

    return result;
  } catch (error) {
    console.error('[GET_DAILY_API_CALLS_BY_PROVIDER_ERROR]', error);
    return [];
  }
}

export default async function Stats() {
  const data = await getDailyApiCallsByProvider();
  return <PieGraph data={data} />;
}
