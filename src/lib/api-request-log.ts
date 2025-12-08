import { prisma } from '@/lib/prisma';

export interface ApiRequestLogItem {
  id: string;
  userClerkId: string;
  serviceProvider: string;
  requestApi: string;
  requestBody: string;
  responseBody: string;
  displayResponseBody: string | null; // 虚拟返回参数（用于界面显示，已过滤敏感字段）
  cost: number;
  createdAt: Date;
}

export interface ListApiRequestLogParams {
  page?: number | null;
  perPage?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  userClerkId?: string | null; // 如果提供，只查询该用户的日志；如果为 null 且 isAdmin，查询所有
  isAdmin?: boolean;
}

// 由于本地 Prisma Client 可能还没重新生成，类型上暂时没有 apiRequestLog delegate，
// 这里通过 any 断言绕过 TS 检查，避免构建报错；实际运行时仍然会调用 prisma.apiRequestLog。
const prismaAny = prisma as any;

/**
 * 获取请求日志列表
 */
export async function listApiRequestLog(params: ListApiRequestLogParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 && params.perPage <= 100
      ? params.perPage
      : 10;

  const where: any = {};

  // 时间范围查询
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      // 结束日期包含整天，所以设置为当天的 23:59:59
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  // 权限过滤：非Admin用户只能看自己的日志
  if (!params.isAdmin && params.userClerkId) {
    where.userClerkId = params.userClerkId;
  }
  // Admin用户不限制 userClerkId，可以看所有日志

  const [items, total] = await Promise.all([
    prismaAny.apiRequestLog.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' }
    }),
    prismaAny.apiRequestLog.count({ where })
  ]);

  const data: ApiRequestLogItem[] = (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    userClerkId: item.userClerkId,
    serviceProvider: item.serviceProvider || '',
    requestApi: item.requestApi,
    requestBody: item.requestBody || '',
    responseBody: item.responseBody || '',
    displayResponseBody: item.displayResponseBody || null, // 使用过滤后的响应体（用于界面显示）
    cost: Number(item.cost),
    createdAt: item.createdAt
  }));

  return { items: data, total, page, perPage };
}

/**
 * 导出请求日志（用于CSV导出，不限制数量）
 */
export async function exportApiRequestLog(params: {
  startDate?: string | null;
  endDate?: string | null;
  userClerkId?: string | null;
  isAdmin?: boolean;
}) {
  const where: any = {};

  // 时间范围查询
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  // 权限过滤
  if (!params.isAdmin && params.userClerkId) {
    where.userClerkId = params.userClerkId;
  }

  const items = await prismaAny.apiRequestLog.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    userClerkId: item.userClerkId,
    serviceProvider: item.serviceProvider || '',
    requestApi: item.requestApi,
    requestBody: item.requestBody || '',
    responseBody: item.responseBody || '',
    displayResponseBody: item.displayResponseBody || null, // 使用过滤后的响应体（用于界面显示）
    cost: Number(item.cost),
    createdAt: item.createdAt
  })) as ApiRequestLogItem[];
}
