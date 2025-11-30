/**
 * APISIX 网关管理服务
 * 用于创建和管理 Consumer、路由等
 */

import { prisma } from '@/lib/prisma';

interface ApisixConfig {
  adminKey: string;
  adminUrl: string; // 例如: http://apisix-admin:9180
}

interface CreateConsumerParams {
  username: string; // Consumer 用户名，建议使用 userPricingId
  key: string; // key-auth 的密钥，使用 UserPricing.id
}

interface CreateRouteParams {
  name: string; // 路由名称
  uri: string; // 匹配的 URI 路径，从 ApiPricing.api 获取
  upstream: {
    nodes: Record<string, number>; // 上游节点，格式: { "hostname:port": weight }
    type: 'roundrobin';
  };
  plugins?: {
    'key-auth'?: {
      header: string; // 默认 'apikey'，我们使用 'X-API-Key'
    };
    'proxy-rewrite'?: {
      uri: string; // 转发到上游时的 URI 路径
    };
  };
}

/**
 * 创建 APISIX Consumer（带 key-auth）
 */
export async function createApisixConsumer(
  config: ApisixConfig,
  params: CreateConsumerParams
): Promise<void> {
  const { username, key } = params;

  const response = await fetch(
    `${config.adminUrl}/apisix/admin/consumers/${username}`,
    {
      method: 'PUT',
      headers: {
        'X-API-KEY': config.adminKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        plugins: {
          'key-auth': {
            key
          }
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // 记录详细错误到日志，但不暴露给用户
    console.error('[APISIX_CREATE_CONSUMER_ERROR]', {
      username,
      status: response.status,
      error: errorText
    });
    throw new Error('创建网关配置失败，请稍后重试');
  }
}

/**
 * 删除 APISIX Consumer
 */
export async function deleteApisixConsumer(
  config: ApisixConfig,
  username: string
): Promise<void> {
  const response = await fetch(
    `${config.adminUrl}/apisix/admin/consumers/${username}`,
    {
      method: 'DELETE',
      headers: {
        'X-API-KEY': config.adminKey
      }
    }
  );

  if (!response.ok && response.status !== 404) {
    // 404 表示 Consumer 不存在，可以忽略
    const errorText = await response.text();
    // 记录详细错误到日志，但不暴露给用户
    console.error('[APISIX_DELETE_CONSUMER_ERROR]', {
      username,
      status: response.status,
      error: errorText
    });
    throw new Error('删除网关配置失败，请稍后重试');
  }
}

/**
 * 创建或更新 APISIX 路由
 * 注意：路由应该按服务商（ApiPricing）创建，而不是按用户创建
 * 多个用户共享同一个路由，通过 Consumer 区分权限
 */
export async function upsertApisixRoute(
  config: ApisixConfig,
  routeId: string,
  params: CreateRouteParams
): Promise<void> {
  const response = await fetch(
    `${config.adminUrl}/apisix/admin/routes/${routeId}`,
    {
      method: 'PUT',
      headers: {
        'X-API-KEY': config.adminKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: routeId,
        name: params.name,
        uri: params.uri,
        upstream: params.upstream,
        plugins: params.plugins || {
          'key-auth': {
            header: 'apikey'
          }
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // 记录详细错误到日志，但不暴露给用户
    console.error('[APISIX_UPSERT_ROUTE_ERROR]', {
      routeId,
      status: response.status,
      error: errorText
    });
    throw new Error('创建/更新网关路由失败，请稍后重试');
  }
}

/**
 * 删除 APISIX 路由
 */
export async function deleteApisixRoute(
  config: ApisixConfig,
  routeId: string
): Promise<void> {
  const response = await fetch(
    `${config.adminUrl}/apisix/admin/routes/${routeId}`,
    {
      method: 'DELETE',
      headers: {
        'X-API-KEY': config.adminKey
      }
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    // 记录详细错误到日志，但不暴露给用户
    console.error('[APISIX_DELETE_ROUTE_ERROR]', {
      routeId,
      status: response.status,
      error: errorText
    });
    throw new Error('删除网关路由失败，请稍后重试');
  }
}

/**
 * 获取 APISIX 配置（从 settings 表）
 */
export async function getApisixConfig(): Promise<ApisixConfig> {
  // 从 settings 表获取配置
  const [adminKeySetting, serviceUrlSetting] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: 'ApiSixAdminKey' }
    }),
    prisma.setting.findUnique({
      where: { key: 'ApiSixServiceUrl' }
    })
  ]);

  const adminKey = adminKeySetting?.value;
  const adminUrl = serviceUrlSetting?.value;

  if (!adminKey) {
    console.error('[APISIX_CONFIG_ERROR]', 'ApiSixAdminKey 未配置');
    throw new Error('网关配置错误，请联系管理员');
  }

  if (!adminUrl) {
    console.error('[APISIX_CONFIG_ERROR]', 'ApiSixServiceUrl 未配置');
    throw new Error('网关配置错误，请联系管理员');
  }

  return {
    adminKey,
    adminUrl
  };
}

/**
 * 获取 Next.js 服务地址（用于配置 APISIX upstream）
 */
export async function getNextjsServiceUrl(): Promise<string> {
  // 优先从 settings 表获取
  const setting = await prisma.setting.findUnique({
    where: { key: 'NextjsServiceUrl' }
  });

  if (setting?.value) {
    return setting.value;
  }

  // 如果 settings 表中没有，尝试从环境变量获取
  const envUrl =
    process.env.NEXTJS_SERVICE_URL || process.env.NEXT_PUBLIC_SERVICE_URL;
  if (envUrl) {
    return envUrl;
  }

  // 默认值（开发环境）
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  console.error('[NEXTJS_SERVICE_URL_ERROR]', 'NextjsServiceUrl 未配置');
  throw new Error(
    'Next.js 服务地址未配置，请在系统设置中配置 NextjsServiceUrl'
  );
}
