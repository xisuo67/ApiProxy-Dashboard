import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';

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
  const created = await prismaAny.apiPricing.create({
    data: {
      id: generateIdBigInt(),
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
