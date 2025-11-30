/**
 * 补偿任务服务
 * 用于处理外部 API 成功但扣费失败的情况
 */

import { prisma } from '@/lib/prisma';

const prismaAny = prisma as any;

export interface CompensationTaskItem {
  id: string;
  userId: string;
  userPricingId: string;
  cost: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  // 日志信息（用于对账）
  userClerkId: string;
  serviceProvider: string;
  requestApi: string;
  requestBody: string;
  responseBody: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建补偿任务（包含扣费和日志记录）
 */
export async function createCompensationTask(
  userId: string,
  userPricingId: string,
  cost: number,
  logData: {
    userClerkId: string;
    serviceProvider: string;
    requestApi: string;
    requestBody: string;
    responseBody: string;
  },
  errorMessage?: string
): Promise<CompensationTaskItem> {
  const task = await prismaAny.compensationTask.create({
    data: {
      userId: BigInt(userId),
      userPricingId: BigInt(userPricingId),
      cost,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      errorMessage: errorMessage || null,
      // 日志信息
      userClerkId: logData.userClerkId,
      serviceProvider: logData.serviceProvider,
      requestApi: logData.requestApi,
      requestBody: logData.requestBody,
      responseBody: logData.responseBody
    }
  });

  return {
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
    requestBody: task.requestBody,
    responseBody: task.responseBody,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

/**
 * 处理补偿任务（尝试扣费）
 */
export async function processCompensationTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const task = await prismaAny.compensationTask.findUnique({
    where: { id: BigInt(taskId) },
    include: {
      user: {
        select: {
          id: true,
          balance: true,
          isActive: true
        }
      }
    }
  });

  if (!task) {
    return { success: false, error: '任务不存在' };
  }

  if (task.status === 'completed') {
    return { success: true };
  }

  if (task.status === 'failed') {
    return { success: false, error: '任务已失败，超过最大重试次数' };
  }

  // 检查用户状态
  if (!task.user.isActive) {
    await prismaAny.compensationTask.update({
      where: { id: BigInt(taskId) },
      data: {
        status: 'failed',
        errorMessage: '用户账户已禁用'
      }
    });
    return { success: false, error: '用户账户已禁用' };
  }

  // 检查余额
  const cost = Number(task.cost);
  const currentBalance = Number(task.user.balance);
  if (currentBalance < cost) {
    await prismaAny.compensationTask.update({
      where: { id: BigInt(taskId) },
      data: {
        status: 'failed',
        errorMessage: '余额不足'
      }
    });
    return { success: false, error: '余额不足' };
  }

  // 尝试扣费（使用事务）
  try {
    await prismaAny.$transaction(
      async (tx: any) => {
        // 锁定用户行
        const userWithLock = (await tx.$queryRawUnsafe(
          `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
          task.userId
        )) as Array<{ id: bigint; balance: any }>;

        if (!userWithLock || userWithLock.length === 0) {
          throw new Error('用户不存在');
        }

        const lockedBalance = Number(userWithLock[0].balance);
        if (lockedBalance < cost) {
          throw new Error('余额不足');
        }

        // 扣除余额
        await tx.user.update({
          where: { id: task.userId },
          data: {
            balance: {
              decrement: cost
            }
          }
        });

        // 记录请求日志（用于对账）
        try {
          await tx.apiRequestLog.create({
            data: {
              userClerkId: task.userClerkId,
              serviceProvider: task.serviceProvider,
              requestApi: task.requestApi,
              requestBody: task.requestBody || '',
              responseBody: task.responseBody || '',
              cost
            }
          });
        } catch (logError) {
          // 日志记录失败不影响扣费，但记录错误
          console.error('[COMPENSATION_TASK_LOG_ERROR]', {
            taskId,
            error: logError
          });
        }

        // 更新任务状态
        await tx.compensationTask.update({
          where: { id: BigInt(taskId) },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted'
      }
    );

    return { success: true };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    const retryCount = task.retryCount + 1;

    // 更新重试次数
    await prismaAny.compensationTask.update({
      where: { id: BigInt(taskId) },
      data: {
        retryCount,
        status: retryCount >= task.maxRetries ? 'failed' : 'pending',
        errorMessage: errorMessage
      }
    });

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 获取待处理的补偿任务
 */
export async function getPendingCompensationTasks(
  limit: number = 100
): Promise<CompensationTaskItem[]> {
  // 查询待处理的任务（status = 'pending' 且 retryCount < maxRetries）
  const tasks = await prismaAny.compensationTask.findMany({
    where: {
      status: 'pending'
    },
    orderBy: {
      createdAt: 'asc'
    },
    take: limit
  });

  // 过滤出 retryCount < maxRetries 的任务
  const validTasks = tasks.filter(
    (task: any) => task.retryCount < task.maxRetries
  );

  return validTasks.map((task: any) => ({
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
    requestBody: task.requestBody,
    responseBody: task.responseBody,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }));
}

/**
 * 批量处理补偿任务
 */
export async function batchProcessCompensationTasks(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const tasks = await getPendingCompensationTasks(100);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const task of tasks) {
    processed++;
    const result = await processCompensationTask(task.id);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { processed, succeeded, failed };
}
