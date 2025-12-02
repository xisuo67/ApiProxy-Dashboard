import { prisma } from '@/lib/prisma';

export interface RechargeOrderItem {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  payMethod: string | null;
  status: string;
  providerOrderId: string | null;
  providerSessionId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListRechargeOrdersParams {
  page?: number;
  perPage?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  userId?: string; // 如果提供，只查询该用户的订单；如果不提供且 isAdmin=true，查询所有订单
  isAdmin?: boolean;
}

export async function listRechargeOrders(
  params: ListRechargeOrdersParams
): Promise<{
  items: RechargeOrderItem[];
  total: number;
  page: number;
  perPage: number;
}> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 && params.perPage <= 100
      ? params.perPage
      : 10;

  // 构建查询条件
  const where: any = {};

  // 如果不是管理员，只查询当前用户的订单
  if (!params.isAdmin && params.userId) {
    where.userId = BigInt(params.userId);
  }

  // 状态筛选
  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  // 时间范围筛选
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

  // 查询订单和总数
  const [items, total] = await Promise.all([
    prisma.rechargeOrder.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            clerkId: true,
            email: true,
            name: true
          }
        }
      }
    }),
    prisma.rechargeOrder.count({ where })
  ]);

  // 转换数据格式
  const data: RechargeOrderItem[] = items.map((item) => ({
    id: item.id.toString(),
    amount: item.amount.toString(),
    currency: item.currency,
    provider: item.provider,
    payMethod: item.payMethod,
    status: item.status,
    providerOrderId: item.providerOrderId,
    providerSessionId: item.providerSessionId,
    paidAt: item.paidAt?.toISOString() || null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  }));

  return { items: data, total, page, perPage };
}
