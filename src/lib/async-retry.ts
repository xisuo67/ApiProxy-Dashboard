/**
 * 异步重试服务
 * 用于在扣费失败时立即异步重试
 */

import { prisma } from '@/lib/prisma';

const prismaAny = prisma as any;

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 异步重试扣费和记录日志
 * 使用指数退避策略
 */
export async function retryDeductBalanceAndLog(
  userId: string,
  cost: number,
  logData: {
    userClerkId: string;
    serviceProvider: string;
    requestApi: string;
    requestBody: string;
    responseBody: string;
  },
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  // 异步执行，不阻塞当前请求
  setImmediate(async () => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 计算延迟时间（指数退避：0ms, 1000ms, 2000ms）
        if (attempt > 0) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await delay(delayMs);
        }

        // 尝试扣费和记录日志
        const result = await attemptDeductBalanceAndLog(userId, cost, logData);

        if (result.success) {
          console.log('[RETRY_DEDUCT_BALANCE_AND_LOG_SUCCESS]', {
            userId,
            cost,
            attempt: attempt + 1
          });
          return;
        }

        // 最后一次尝试失败
        if (attempt === maxRetries - 1) {
          console.error('[RETRY_DEDUCT_BALANCE_AND_LOG_FAILED]', {
            userId,
            cost,
            attempts: maxRetries,
            error: result.error
          });
          // 重试失败，需要创建补偿任务（由调用方处理）
        }
      } catch (error: any) {
        console.error('[RETRY_DEDUCT_BALANCE_AND_LOG_ERROR]', {
          userId,
          cost,
          attempt: attempt + 1,
          error: error.message
        });

        // 最后一次尝试失败
        if (attempt === maxRetries - 1) {
          // 重试失败，需要创建补偿任务（由调用方处理）
        }
      }
    }
  });

  // 立即返回，不等待重试结果
  return { success: true };
}

/**
 * 尝试扣费和记录日志（单次）
 */
async function attemptDeductBalanceAndLog(
  userId: string,
  cost: number,
  logData: {
    userClerkId: string;
    serviceProvider: string;
    requestApi: string;
    requestBody: string;
    responseBody: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prismaAny.$transaction(
      async (tx: any) => {
        // 锁定用户行
        const userWithLock = (await tx.$queryRawUnsafe(
          `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
          BigInt(userId)
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
          where: { id: BigInt(userId) },
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
              userClerkId: logData.userClerkId,
              serviceProvider: logData.serviceProvider,
              requestApi: logData.requestApi,
              requestBody: logData.requestBody || '',
              responseBody: logData.responseBody || '',
              cost
            }
          });
        } catch (logError) {
          // 日志记录失败不影响扣费，但抛出错误以便重试
          console.error('[ATTEMPT_LOG_ERROR]', {
            userId,
            error: logError
          });
          throw new Error(
            `日志记录失败: ${logError instanceof Error ? logError.message : String(logError)}`
          );
        }
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
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 异步重试记录失败请求的日志
 * 使用指数退避策略
 * 注意：失败请求不扣费，只记录日志
 */
export async function retryLogFailedRequest(
  logData: {
    userClerkId: string;
    serviceProvider: string;
    requestApi: string;
    requestBody: string;
    responseBody: string;
    displayResponseBody: string | null;
  },
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  // 异步执行，不阻塞当前请求
  setImmediate(async () => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 计算延迟时间（指数退避：0ms, 1000ms, 2000ms）
        if (attempt > 0) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await delay(delayMs);
        }

        // 尝试记录日志
        await prismaAny.apiRequestLog.create({
          data: {
            userClerkId: logData.userClerkId,
            serviceProvider: logData.serviceProvider,
            requestApi: logData.requestApi,
            requestBody: logData.requestBody || '',
            responseBody: logData.responseBody || '',
            displayResponseBody: logData.displayResponseBody || null,
            cost: 0 // 失败时不扣费
          }
        });

        console.log('[RETRY_LOG_FAILED_REQUEST_SUCCESS]', {
          userClerkId: logData.userClerkId,
          requestApi: logData.requestApi,
          attempt: attempt + 1
        });
        return;
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        console.error('[RETRY_LOG_FAILED_REQUEST_ERROR]', {
          userClerkId: logData.userClerkId,
          requestApi: logData.requestApi,
          attempt: attempt + 1,
          error: errorMessage
        });

        // 最后一次尝试失败
        if (attempt === maxRetries - 1) {
          console.error('[RETRY_LOG_FAILED_REQUEST_FAILED]', {
            userClerkId: logData.userClerkId,
            requestApi: logData.requestApi,
            attempts: maxRetries,
            error: errorMessage
          });
        }
      }
    }
  });

  // 立即返回，不等待重试结果
  return { success: true };
}
