import { prisma } from '@/lib/prisma';

const prismaAny = prisma as any;

export type CompensationTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CompensationTaskListItem {
  id: string;
  userId: string;
  userPricingId: string;
  cost: number;
  status: CompensationTaskStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  userClerkId: string;
  serviceProvider: string;
  requestApi: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ListCompensationTaskParams {
  page?: number | null;
  perPage?: number | null;
  status?: CompensationTaskStatus | 'all' | null;
}

export async function listCompensationTasks(
  params: ListCompensationTaskParams
) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 && params.perPage <= 100
      ? params.perPage
      : 10;

  const where: any = {};

  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  const [items, total] = await Promise.all([
    prismaAny.compensationTask.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' }
    }),
    prismaAny.compensationTask.count({ where })
  ]);

  const data: CompensationTaskListItem[] = (items as any[]).map(
    (task: any) => ({
      id: task.id.toString(),
      userId: task.userId.toString(),
      userPricingId: task.userPricingId.toString(),
      cost: Number(task.cost),
      status: task.status,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      errorMessage: task.errorMessage,
      userClerkId: task.userClerkId,
      serviceProvider: task.serviceProvider,
      requestApi: task.requestApi,
      createdAt: task.createdAt,
      completedAt: task.completedAt
    })
  );

  return { items: data, total, page, perPage };
}
