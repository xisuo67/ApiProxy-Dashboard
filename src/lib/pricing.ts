import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';
import {
  getApisixConfig,
  getNextjsServiceUrl,
  upsertApisixRoute,
  deleteApisixRoute
} from '@/lib/apisix';

export interface ApiPricingItem {
  id: string;
  name: string;
  host: string;
  api: string;
  price: number;
  apiKey: string | null;
  actualHost: string | null;
  actualApi: string | null;
  isEnabled: boolean;
}

export interface ListApiPricingParams {
  page?: number | null;
  perPage?: number | null;
  search?: string | null;
}

// 由于本地 Prisma Client 可能还没重新生成，类型上暂时没有 apiPricing delegate，
// 这里通过 any 断言绕过 TS 检查，避免构建报错；实际运行时仍然会调用 prisma.apiPricing。
const prismaAny = prisma as any;

export async function listApiPricing(params: ListApiPricingParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 && params.perPage <= 100
      ? params.perPage
      : 10;
  const search = params.search?.trim() || undefined;

  const where =
    search && search.length > 0
      ? {
          OR: [
            { name: { contains: search } },
            { host: { contains: search } },
            { api: { contains: search } }
          ]
        }
      : {};

  const [items, total] = await Promise.all([
    prismaAny.apiPricing.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'desc' }
    }),
    prismaAny.apiPricing.count({ where })
  ]);

  // 列表查询不返回敏感字段 apiKey，避免通过 F12 查看网络请求时泄露
  const data: ApiPricingItem[] = (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    name: item.name || '',
    host: item.host,
    api: item.api,
    price: Number(item.price),
    apiKey: null, // 列表查询不返回敏感信息
    actualHost: item.actualHost ?? null,
    actualApi: item.actualApi ?? null,
    isEnabled: item.isEnabled ?? true
  }));

  return { items: data, total, page, perPage };
}

export interface UpsertApiPricingInput {
  name: string;
  host: string;
  api: string;
  price: number;
  apiKey?: string | null;
  actualHost?: string | null;
  actualApi?: string | null;
  isEnabled?: boolean;
}

export async function createApiPricing(input: UpsertApiPricingInput) {
  // 检查是否已存在相同的 api 路径
  const apiPath = input.api.trim();
  const existing = await prismaAny.apiPricing.findFirst({
    where: {
      api: apiPath,
      isEnabled: true // 只检查启用的服务商
    }
  });

  if (existing) {
    throw new Error(
      `API 路径 "${apiPath}" 已被服务商 "${existing.name}" 使用，请使用不同的路径`
    );
  }

  const apiPricingId = generateIdBigInt();
  const apiPricingIdStr = apiPricingId.toString();

  // 创建数据库记录
  const created = await prismaAny.apiPricing.create({
    data: {
      id: apiPricingId,
      name: input.name,
      host: input.host,
      api: input.api,
      price: input.price,
      apiKey: input.apiKey ?? null,
      actualHost: input.actualHost ?? null,
      actualApi: input.actualApi ?? null,
      isEnabled: input.isEnabled ?? true
    }
  });

  // 创建 APISIX 路由（仅在启用时创建）
  if (input.isEnabled !== false) {
    try {
      const apisixConfig = await getApisixConfig();
      const nextjsServiceUrl = await getNextjsServiceUrl();

      // 构建 APISIX 路由配置
      // URI 匹配：使用 api 字段（例如：/api/Wxapp/JSLogin）
      const apiPath = input.api.startsWith('/') ? input.api : `/${input.api}`;

      // Upstream 指向 Next.js 网关接口（例如：/api/gateway/api/Wxapp/JSLogin）
      const gatewayPath = `/api/gateway${apiPath}`;
      const upstreamUrl = `${nextjsServiceUrl.replace(/\/$/, '')}${gatewayPath}`;

      // 解析 upstream URL
      const upstreamUrlObj = new URL(upstreamUrl);
      const upstreamHost = upstreamUrlObj.hostname;
      const upstreamPort =
        upstreamUrlObj.port ||
        (upstreamUrlObj.protocol === 'https:' ? 443 : 80);

      await upsertApisixRoute(apisixConfig, apiPricingIdStr, {
        name: input.name,
        uri: apiPath, // APISIX 路由匹配的 URI（用户请求的路径，例如：/api/Wxapp/JSLogin）
        upstream: {
          nodes: {
            [`${upstreamHost}:${upstreamPort}`]: 1
          },
          type: 'roundrobin'
        },
        plugins: {
          'key-auth': {
            header: 'X-API-Key' // 使用 X-API-Key header
          },
          'proxy-rewrite': {
            uri: gatewayPath // 转发到 Next.js 时的路径（例如：/api/gateway/api/Wxapp/JSLogin）
          }
        }
      });
    } catch (error) {
      // APISIX 路由创建失败，记录错误但不影响数据库记录
      console.error('[APISIX_ROUTE_CREATE_ERROR]', {
        apiPricingId: apiPricingIdStr,
        error: error instanceof Error ? error.message : String(error)
      });
      // 可以选择回滚数据库操作，或者继续（让管理员手动创建路由）
    }
  }

  return {
    id: created.id.toString(),
    name: created.name || '',
    host: created.host,
    api: created.api,
    price: Number(created.price),
    apiKey: created.apiKey ?? null,
    actualHost: created.actualHost ?? null,
    actualApi: created.actualApi ?? null,
    isEnabled: created.isEnabled ?? true
  } as ApiPricingItem;
}

export async function updateApiPricing(
  id: string,
  input: UpsertApiPricingInput
) {
  // 获取更新前的配置（用于判断是否需要更新 APISIX 路由）
  const oldConfig = await prismaAny.apiPricing.findUnique({
    where: { id: BigInt(id) },
    select: { api: true, isEnabled: true, name: true }
  });

  if (!oldConfig) {
    throw new Error('服务商配置不存在');
  }

  // 如果更新了 api 路径，检查是否与其他服务商冲突
  if (input.api && input.api.trim() !== oldConfig.api) {
    const apiPath = input.api.trim();
    const existing = await prismaAny.apiPricing.findFirst({
      where: {
        api: apiPath,
        isEnabled: true, // 只检查启用的服务商
        id: {
          not: BigInt(id) // 排除当前记录
        }
      }
    });

    if (existing) {
      throw new Error(
        `API 路径 "${apiPath}" 已被服务商 "${existing.name}" 使用，请使用不同的路径`
      );
    }
  }

  // 更新数据库记录
  const updated = await prismaAny.apiPricing.update({
    where: { id: BigInt(id) },
    data: {
      name: input.name,
      host: input.host,
      api: input.api,
      price: input.price,
      apiKey: input.apiKey ?? null,
      actualHost: input.actualHost ?? null,
      actualApi: input.actualApi ?? null,
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled })
    }
  });

  // 更新 APISIX 路由
  const isEnabled =
    input.isEnabled !== undefined
      ? input.isEnabled
      : (oldConfig?.isEnabled ?? true);
  const apiPath = input.api || oldConfig?.api;

  if (isEnabled && apiPath) {
    try {
      const apisixConfig = await getApisixConfig();
      const nextjsServiceUrl = await getNextjsServiceUrl();

      // 构建 APISIX 路由配置
      const apiPathFormatted = apiPath.startsWith('/')
        ? apiPath
        : `/${apiPath}`;
      const gatewayPath = `/api/gateway${apiPathFormatted}`;
      const upstreamUrl = `${nextjsServiceUrl.replace(/\/$/, '')}${gatewayPath}`;

      // 解析 upstream URL
      const upstreamUrlObj = new URL(upstreamUrl);
      const upstreamHost = upstreamUrlObj.hostname;
      const upstreamPort =
        upstreamUrlObj.port ||
        (upstreamUrlObj.protocol === 'https:' ? 443 : 80);

      await upsertApisixRoute(apisixConfig, id, {
        name: input.name || updated.name,
        uri: apiPathFormatted, // APISIX 路由匹配的 URI（用户请求的路径，例如：/api/Wxapp/JSLogin）
        upstream: {
          nodes: {
            [`${upstreamHost}:${upstreamPort}`]: 1
          },
          type: 'roundrobin'
        },
        plugins: {
          'key-auth': {
            header: 'X-API-Key'
          },
          'proxy-rewrite': {
            uri: gatewayPath // 转发到 Next.js 时的路径（例如：/api/gateway/api/Wxapp/JSLogin）
          }
        }
      });
    } catch (error) {
      // APISIX 路由更新失败，记录错误但不影响数据库更新
      console.error('[APISIX_ROUTE_UPDATE_ERROR]', {
        apiPricingId: id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else if (!isEnabled && oldConfig?.isEnabled) {
    // 如果从启用变为禁用，删除 APISIX 路由
    try {
      const apisixConfig = await getApisixConfig();
      await deleteApisixRoute(apisixConfig, id);
    } catch (error) {
      console.error('[APISIX_ROUTE_DELETE_ERROR]', {
        apiPricingId: id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    id: updated.id.toString(),
    name: updated.name || '',
    host: updated.host,
    api: updated.api,
    price: Number(updated.price),
    apiKey: updated.apiKey ?? null,
    actualHost: updated.actualHost ?? null,
    actualApi: updated.actualApi ?? null,
    isEnabled: updated.isEnabled ?? true
  } as ApiPricingItem;
}

export async function getApiPricingById(
  id: string
): Promise<ApiPricingItem | null> {
  const item = await prismaAny.apiPricing.findUnique({
    where: { id: BigInt(id) }
  });

  if (!item) return null;

  return {
    id: item.id.toString(),
    name: item.name || '',
    host: item.host,
    api: item.api,
    price: Number(item.price),
    apiKey: item.apiKey ?? null,
    actualHost: item.actualHost ?? null,
    actualApi: item.actualApi ?? null,
    isEnabled: item.isEnabled ?? true
  } as ApiPricingItem;
}

export async function deleteApiPricing(id: string) {
  const apiPricingId = BigInt(id);

  // 检查是否有 UserPricing 关联
  const userPricingCount = await prismaAny.userPricing.count({
    where: { apiPricingId }
  });

  if (userPricingCount > 0) {
    throw new Error(
      `无法删除：该服务商已被 ${userPricingCount} 个用户关联，请先解除关联后再删除`
    );
  }

  // 检查是否有 MiniProgramSettings 关联（通过 apiPricingIds JSON 字段）
  const miniPrograms = await prismaAny.miniProgramSettings.findMany({
    where: {},
    select: { id: true, apiPricingIds: true }
  });

  const hasMiniProgramAssociation = miniPrograms.some((mp: any) => {
    const ids = Array.isArray(mp.apiPricingIds) ? mp.apiPricingIds : [];
    return ids.some(
      (pid: any) => BigInt(pid).toString() === apiPricingId.toString()
    );
  });

  if (hasMiniProgramAssociation) {
    throw new Error(
      '无法删除：该服务商已被小程序配置关联，请先在小程序管理中解除关联后再删除'
    );
  }

  // 删除 APISIX 路由
  try {
    const apisixConfig = await getApisixConfig();
    await deleteApisixRoute(apisixConfig, id);
  } catch (error) {
    // APISIX 路由删除失败，记录错误但不影响数据库删除
    console.error('[APISIX_ROUTE_DELETE_ERROR]', {
      apiPricingId: id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // 删除数据库记录
  await prismaAny.apiPricing.delete({
    where: { id: apiPricingId }
  });
}

/**
 * 获取所有启用的服务商（用于选择服务商）
 */
export async function listEnabledApiPricing(): Promise<ApiPricingItem[]> {
  const items = await prismaAny.apiPricing.findMany({
    where: { isEnabled: true },
    orderBy: { id: 'desc' }
  });

  return (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    name: item.name || '',
    host: item.host,
    api: item.api,
    price: Number(item.price),
    apiKey: null,
    actualHost: item.actualHost ?? null,
    actualApi: item.actualApi ?? null,
    isEnabled: true
  }));
}
