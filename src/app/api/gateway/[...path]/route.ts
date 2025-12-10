/**
 * 网关接口：处理来自 APISIX 的请求
 *
 * 流程：
 * 1. APISIX 通过 key-auth 验证后，转发请求到此接口（携带 X-API-Key: UserPricing.id）
 * 2. 通过 UserPricing.id 查询用户和配置信息
 * 3. 进行认证、计费、记录日志
 * 4. 转发请求到目标接口（ApiPricing.actualHost + ApiPricing.actualApi）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  retryDeductBalanceAndLog,
  retryLogFailedRequest
} from '@/lib/async-retry';
import { createCompensationTask } from '@/lib/compensation-task';

const prismaAny = prisma as any;

/**
 * 从请求中获取 UserPricing.id（来自 APISIX key-auth）
 */
function getUserPricingIdFromRequest(req: NextRequest): string | null {
  // APISIX key-auth 会将密钥放在 X-API-Key header 中
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('apikey');
  return apiKey || null;
}

/**
 * 代理请求到目标接口
 */
async function proxyRequest(
  targetUrl: string,
  req: NextRequest,
  targetApiKey: string | null,
  body: string | null, // 直接传递已读取的 body，避免多次读取
  shouldFilterRemainingCalls: boolean = false // 是否过滤 remaining_calls 字段
): Promise<Response> {
  // 构建目标请求头（原封不动复制，但替换 X-API-Key）
  const headers: HeadersInit = {};

  // 需要排除的请求头列表
  const excludeHeaders = [
    'host',
    'connection',
    'content-length',
    // APISIX 相关请求头
    'x-consumer-username',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-proto',
    'x-real-ip',
    // Clerk 相关请求头
    'x-clerk-auth-message',
    'x-clerk-auth-reason',
    'x-clerk-auth-signature',
    'x-clerk-auth-status',
    'x-clerk-auth-token',
    'x-clerk-clerk-url',
    // Postman 相关请求头
    'postman-token',
    // 缓存相关
    'cache-control'
  ];

  // 复制原始请求头（排除不需要的）
  let hasContentType = false;
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!excludeHeaders.includes(lowerKey)) {
      // 不复制 X-API-Key 和 apikey，后面会用 ApiPricing.apiKey 替换
      if (lowerKey !== 'x-api-key' && lowerKey !== 'apikey') {
        // 统一使用小写的 key，避免重复
        if (lowerKey === 'content-type') {
          hasContentType = true;
          headers['Content-Type'] = value; // 统一使用首字母大写的格式
        } else {
          headers[key] = value;
        }
      }
    }
  });

  // 替换为目标接口的认证密钥（从 ApiPricing.apiKey 获取）
  if (targetApiKey) {
    headers['X-API-Key'] = targetApiKey;
  }

  // 确保 Content-Type 存在（如果有请求体且没有 Content-Type）
  if (body && body.length > 0 && !hasContentType) {
    headers['Content-Type'] = 'application/json';
  }

  // 转发请求
  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body || undefined
  });

  // 获取响应内容（原始响应体，不过滤，直接返回）
  // 过滤逻辑在 handleProxyRequest 中处理
  const responseBody = await response.text();
  const contentType = response.headers.get('Content-Type') || '';

  // 返回原始响应（不过滤，在 handleProxyRequest 中处理过滤）
  return new NextResponse(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': contentType || 'application/json'
    }
  });
}

// 递归移除对象中的 remaining_calls 字段
function removeRemainingCalls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => removeRemainingCalls(item));
  } else if (obj !== null && typeof obj === 'object') {
    const filtered: any = {};
    for (const key in obj) {
      if (key !== 'remaining_calls') {
        filtered[key] = removeRemainingCalls(obj[key]);
      }
    }
    return filtered;
  }
  return obj;
}

// 注意：logRequest 函数已移除，日志记录现在在事务中直接处理
// 注意：deductBalance 函数已移除，余额扣除现在在 handleProxyRequest 中直接处理

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return handleProxyRequest(req, params);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return handleProxyRequest(req, params);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return handleProxyRequest(req, params);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return handleProxyRequest(req, params);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return handleProxyRequest(req, params);
}

async function handleProxyRequest(
  req: NextRequest,
  _params: { path: string[] }
) {
  try {
    // 1. 获取 UserPricing.id（来自 APISIX key-auth）
    const userPricingIdStr = getUserPricingIdFromRequest(req);
    if (!userPricingIdStr) {
      return NextResponse.json({ message: '缺少认证信息' }, { status: 401 });
    }

    // 2. 查询 UserPricing 及相关信息
    const userPricing = await prismaAny.userPricing.findUnique({
      where: { id: BigInt(userPricingIdStr) },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            balance: true,
            isActive: true
          }
        },
        apiPricing: {
          select: {
            id: true,
            name: true,
            actualHost: true,
            actualApi: true,
            apiKey: true,
            price: true,
            isEnabled: true
          }
        }
      }
    });

    if (!userPricing) {
      return NextResponse.json({ message: '认证信息无效' }, { status: 401 });
    }

    // 3. 认证检查
    if (!userPricing.user.isActive) {
      return NextResponse.json({ message: '用户账户已禁用' }, { status: 403 });
    }

    if (!userPricing.apiPricing.isEnabled) {
      return NextResponse.json({ message: '服务商已禁用' }, { status: 403 });
    }

    // 3. 快速余额检查（不锁定，仅用于提前判断）
    const cost = Number(userPricing.apiPricing.price);
    const currentBalance = Number(userPricing.user.balance);
    if (currentBalance < cost) {
      return NextResponse.json({ message: '余额不足' }, { status: 402 });
    }

    // 4. 构建目标 URL（使用 actualHost + actualApi，不需要路径后缀）
    const actualHost = userPricing.apiPricing.actualHost;
    const actualApi = userPricing.apiPricing.actualApi;

    if (!actualHost || !actualApi) {
      return NextResponse.json(
        { message: '服务商配置不完整' },
        { status: 500 }
      );
    }

    // 构建完整的目标 URL：actualHost + actualApi
    let targetUrl = `${actualHost.replace(/\/$/, '')}${actualApi.startsWith('/') ? actualApi : '/' + actualApi}`;

    // 将原始请求的查询参数附加到目标 URL
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.toString()) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}${searchParams.toString()}`;
    }

    // 5. 获取请求体和查询参数（用于日志记录）
    const requestMethod = req.method;

    // 获取用户请求的 APISIX 接口地址（用于日志记录）
    // 格式：GET /api/getArticle 或 POST /api/sendMessage
    const userRequestPath = req.nextUrl.pathname; // 例如：/api/gateway/getArticle
    // 移除 /api/gateway 前缀，得到用户实际请求的接口路径
    const apiPath = userRequestPath.replace(/^\/api\/gateway/, '') || '/';
    const requestApi = `${requestMethod} ${apiPath}`;

    // 获取请求体
    let requestBody = await req
      .clone()
      .text()
      .catch(() => '');

    // GET 请求：只记录查询参数（格式化为 JSON）
    if (requestMethod === 'GET' && searchParams.toString()) {
      const queryParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      requestBody = JSON.stringify(queryParams);
    }
    // POST/PUT/PATCH 等请求：直接使用原始 body（不包装）
    // requestBody 已经是原始内容，不需要修改

    // 6. 转发请求到目标接口（先调用外部 API，减少锁持有时间）
    // 注意：requestBody 已经在上面读取过了，直接传递给 proxyRequest，避免多次读取 req.body
    // 仅对 /api/Wxapp/JSLogin 接口过滤 remaining_calls 字段
    const shouldFilterRemainingCalls = apiPath === '/api/Wxapp/JSLogin';
    const response = await proxyRequest(
      targetUrl,
      req,
      userPricing.apiPricing.apiKey,
      requestMethod === 'GET' ? null : requestBody, // GET 请求没有 body，POST/PUT/PATCH 等使用已读取的 requestBody
      shouldFilterRemainingCalls // 是否过滤 remaining_calls
    );

    // 7. 获取响应体（用于日志记录和判断是否成功）
    // 直接从响应体中读取原始响应体（未过滤的，用于日志记录）
    // 注意：response.clone().text() 返回的字符串不会改变，可以安全地保存到 responseBody
    const responseBody = await response
      .clone()
      .text()
      .catch(() => '');
    const contentType = response.headers.get('Content-Type') || '';

    // 8. 生成过滤后的响应体（用于界面显示，移除 remaining_calls 等敏感字段）
    // 仅对 /api/Wxapp/JSLogin 接口过滤 remaining_calls 字段
    // 基于原始 responseBody 生成 displayResponseBody（过滤后的）
    let displayResponseBody: string | null = null;
    if (
      shouldFilterRemainingCalls &&
      contentType.includes('application/json') &&
      responseBody
    ) {
      try {
        const jsonData = JSON.parse(responseBody);
        if (typeof jsonData === 'object' && jsonData !== null) {
          // 递归移除所有 remaining_calls 字段
          const filteredData = removeRemainingCalls(jsonData);
          displayResponseBody = JSON.stringify(filteredData);
        }
      } catch (error) {
        // 如果不是有效的 JSON，保持原样
        displayResponseBody = responseBody;
      }
    } else {
      // 不需要过滤，直接使用原始响应体
      displayResponseBody = responseBody;
    }

    // 9. 生成返回给客户端的响应体（过滤后的）
    // 基于原始 responseBody 生成 clientResponseBody（过滤后的）
    let clientResponseBody = responseBody;
    if (
      shouldFilterRemainingCalls &&
      contentType.includes('application/json') &&
      responseBody
    ) {
      try {
        const jsonData = JSON.parse(responseBody);
        if (typeof jsonData === 'object' && jsonData !== null) {
          // 递归移除所有 remaining_calls 字段
          const filteredData = removeRemainingCalls(jsonData);
          clientResponseBody = JSON.stringify(filteredData);
        }
      } catch (error) {
        // 如果不是有效的 JSON，保持原样
        clientResponseBody = responseBody;
      }
    }

    // 判断是否成功：
    // 1. HTTP 状态码必须是 2xx
    // 2. 如果有响应体，需要检查业务逻辑是否成功（某些接口可能返回 2xx 但业务失败）
    let isSuccess = false;

    if (response.ok) {
      // HTTP 状态码是 2xx，继续检查业务逻辑
      if (!responseBody || responseBody.length === 0) {
        // 空响应体：如果状态码是 2xx，认为是成功的（某些接口可能返回空响应）
        isSuccess = true;
      } else if (contentType.includes('application/json')) {
        // JSON 响应：检查业务逻辑是否成功
        try {
          const jsonData = JSON.parse(responseBody);
          // 检查常见的业务错误标识
          // 优先级：Success/success > Code/code > error/Error/message/Message
          if (typeof jsonData === 'object' && jsonData !== null) {
            // 优先检查 Success 字段（常见格式：{"Success": true/false}）
            if ('Success' in jsonData) {
              isSuccess =
                jsonData.Success === true || jsonData.Success === 'true';
            }
            // 检查 success 字段（小写）
            else if ('success' in jsonData) {
              isSuccess =
                jsonData.success === true || jsonData.success === 'true';
            }
            // 检查 Code 字段（常见格式：{"Code": 0 表示成功，Code: -1 表示失败}）
            else if ('Code' in jsonData) {
              isSuccess = jsonData.Code === 0 || jsonData.Code === '0';
            }
            // 检查 code 字段（小写）
            else if ('code' in jsonData) {
              const code = jsonData.code;
              isSuccess = code === 0 || code === '0' || code === 'success';
            }
            // 检查 error 或 Error 字段（如果存在且不为空，表示失败）
            else if (
              'error' in jsonData ||
              'Error' in jsonData ||
              'message' in jsonData ||
              'Message' in jsonData
            ) {
              // 如果只有错误字段但没有明确的成功标识，需要进一步判断
              // 检查是否有明确的错误信息
              const hasError =
                (jsonData.error && jsonData.error !== '') ||
                (jsonData.Error && jsonData.Error !== '') ||
                (jsonData.message &&
                  typeof jsonData.message === 'string' &&
                  jsonData.message.toLowerCase().includes('error')) ||
                (jsonData.Message &&
                  typeof jsonData.Message === 'string' &&
                  jsonData.Message.toLowerCase().includes('error'));

              // 如果没有明确的错误信息，且状态码是 2xx，认为是成功的
              isSuccess = !hasError;
            }
            // 如果没有明确的成功/失败标识，且状态码是 2xx，认为是成功的
            else {
              isSuccess = true;
            }
          } else {
            // 非对象类型，如果状态码是 2xx，认为是成功的
            isSuccess = true;
          }
        } catch (error) {
          // JSON 解析失败，如果状态码是 2xx，认为是成功的（可能是其他格式的响应）
          isSuccess = true;
        }
      } else {
        // 非 JSON 响应，如果状态码是 2xx，认为是成功的
        isSuccess = true;
      }
    } else {
      // HTTP 状态码不是 2xx，肯定是失败的
      isSuccess = false;
    }

    // 8. 扣除余额和记录日志（仅在成功且有响应时）
    // 使用混合方案：先异步重试，失败后创建补偿任务
    if (isSuccess) {
      try {
        // 使用事务：锁定用户行、检查余额、扣费、记录日志（原子操作）
        await prismaAny.$transaction(
          async (tx: any) => {
            // 锁定用户行并检查余额
            const userWithLock = (await tx.$queryRawUnsafe(
              `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
              userPricing.user.id
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
              where: { id: userPricing.user.id },
              data: {
                balance: {
                  decrement: cost
                }
              }
            });

            // 记录请求日志（用于对账）
            try {
              // responseBody 是从 response.clone().text() 读取的原始响应体（不会改变）
              // 直接保存到 responseBody 字段（包含 remaining_calls，用于对账）
              // displayResponseBody 是过滤后的响应体（不包含 remaining_calls，用于界面显示）
              await tx.apiRequestLog.create({
                data: {
                  userClerkId: userPricing.user.clerkId,
                  serviceProvider: userPricing.apiPricing.name,
                  requestApi,
                  requestBody: requestBody || '',
                  responseBody: responseBody || '', // 原始完整响应（包含 remaining_calls）
                  displayResponseBody: displayResponseBody || null, // 过滤后的响应（用于界面显示）
                  cost
                }
              });
            } catch (logError) {
              // 日志记录失败，抛出错误以便重试或创建补偿任务
              console.error('[LOG_REQUEST_IN_TRANSACTION_ERROR]', {
                userId: userPricing.user.id.toString(),
                error: logError
              });
              throw new Error(
                `日志记录失败: ${logError instanceof Error ? logError.message : String(logError)}`
              );
            }
          },
          {
            maxWait: 5000, // 等待锁的最大时间（5秒）
            timeout: 10000, // 事务超时时间（10秒）
            isolationLevel: 'ReadCommitted' // 使用读已提交隔离级别，减少死锁
          }
        );

        // 扣费和日志都成功，无需后续处理
      } catch (error: any) {
        // 处理死锁、超时或其他错误
        const errorMessage = error.message || String(error);
        const isDeadlock =
          errorMessage.includes('Deadlock') ||
          errorMessage.includes('deadlock');
        const isTimeout =
          errorMessage.includes('timeout') || errorMessage.includes('Timeout');

        // 准备日志数据
        const logData = {
          userClerkId: userPricing.user.clerkId,
          serviceProvider: userPricing.apiPricing.name,
          requestApi,
          requestBody: requestBody || '',
          responseBody: responseBody || '',
          displayResponseBody: displayResponseBody || null
        };

        if (isDeadlock || isTimeout) {
          console.error('[DEDUCT_BALANCE_DEADLOCK_OR_TIMEOUT]', {
            userId: userPricing.user.id.toString(),
            cost,
            error: errorMessage
          });

          // 方案 C：先异步重试，失败后创建补偿任务
          retryDeductBalanceAndLog(
            userPricing.user.id.toString(),
            cost,
            logData,
            3 // 最多重试 3 次
          )
            .then((result) => {
              if (!result.success) {
                // 异步重试失败，创建补偿任务
                createCompensationTask(
                  userPricing.user.id.toString(),
                  userPricingIdStr,
                  cost,
                  logData,
                  `异步重试失败: ${result.error}`
                ).catch((compensationError) => {
                  console.error('[CREATE_COMPENSATION_TASK_ERROR]', {
                    userId: userPricing.user.id.toString(),
                    error: compensationError
                  });
                });
              }
            })
            .catch((retryError) => {
              // 重试过程出错，直接创建补偿任务
              console.error('[RETRY_DEDUCT_BALANCE_ERROR]', {
                userId: userPricing.user.id.toString(),
                error: retryError
              });
              createCompensationTask(
                userPricing.user.id.toString(),
                userPricingIdStr,
                cost,
                logData,
                `重试过程出错: ${retryError instanceof Error ? retryError.message : String(retryError)}`
              ).catch((compensationError) => {
                console.error('[CREATE_COMPENSATION_TASK_ERROR]', {
                  userId: userPricing.user.id.toString(),
                  error: compensationError
                });
              });
            });
        } else {
          // 其他错误（如余额不足、用户不存在等），直接创建补偿任务
          console.error('[DEDUCT_BALANCE_ERROR]', {
            userId: userPricing.user.id.toString(),
            cost,
            error: errorMessage
          });

          createCompensationTask(
            userPricing.user.id.toString(),
            userPricingIdStr,
            cost,
            logData,
            errorMessage
          ).catch((compensationError) => {
            console.error('[CREATE_COMPENSATION_TASK_ERROR]', {
              userId: userPricing.user.id.toString(),
              error: compensationError
            });
          });
        }
        // 扣费/日志失败，但外部 API 已成功，不影响响应
      }
    } else {
      // 9. 请求失败：只记录日志，不扣费（包含重试机制）
      try {
        await prismaAny.apiRequestLog.create({
          data: {
            userClerkId: userPricing.user.clerkId,
            serviceProvider: userPricing.apiPricing.name,
            requestApi,
            requestBody: requestBody || '',
            responseBody: responseBody || '',
            displayResponseBody: displayResponseBody || null,
            cost: 0 // 失败时不扣费
          }
        });
      } catch (logError) {
        // 日志记录失败，使用重试机制
        console.error('[LOG_FAILED_REQUEST_ERROR]', {
          userId: userPricing.user.id.toString(),
          error: logError
        });

        // 异步重试记录日志
        retryLogFailedRequest(
          {
            userClerkId: userPricing.user.clerkId,
            serviceProvider: userPricing.apiPricing.name,
            requestApi,
            requestBody: requestBody || '',
            responseBody: responseBody || '',
            displayResponseBody: displayResponseBody || null
          },
          3 // 最多重试 3 次
        ).catch((retryError) => {
          console.error('[RETRY_LOG_FAILED_REQUEST_FINAL_ERROR]', {
            userId: userPricing.user.id.toString(),
            error: retryError
          });
        });
      }
    }

    // 10. 返回响应（使用过滤后的响应体）
    return new NextResponse(clientResponseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': contentType || 'application/json'
      }
    });
  } catch (error: any) {
    console.error('[PROXY_REQUEST_ERROR]', {
      error: error.message,
      stack: error.stack
    });

    // 不暴露内部错误信息
    return NextResponse.json(
      { message: '请求处理失败，请稍后重试' },
      { status: 500 }
    );
  }
}
