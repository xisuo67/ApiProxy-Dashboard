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
    actualApi: item.actualApi ?? null
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
      actualApi: input.actualApi ?? null
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
    actualApi: created.actualApi ?? null
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
      actualApi: input.actualApi ?? null
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
    actualApi: updated.actualApi ?? null
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
    actualApi: item.actualApi ?? null
  } as ApiPricingItem;
}

export async function deleteApiPricing(id: string) {
  await prismaAny.apiPricing.delete({
    where: { id: BigInt(id) }
  });
}
