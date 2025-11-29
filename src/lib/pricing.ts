import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';

export interface ApiPricingItem {
  id: string;
  host: string;
  api: string;
  price: number;
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
          OR: [{ host: { contains: search } }, { api: { contains: search } }]
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

  const data: ApiPricingItem[] = (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    host: item.host,
    api: item.api,
    price: Number(item.price),
    actualHost: item.actualHost ?? null,
    actualApi: item.actualApi ?? null
  }));

  return { items: data, total, page, perPage };
}

export interface UpsertApiPricingInput {
  host: string;
  api: string;
  price: number;
  actualHost?: string | null;
  actualApi?: string | null;
}

export async function createApiPricing(input: UpsertApiPricingInput) {
  const created = await prismaAny.apiPricing.create({
    data: {
      id: generateIdBigInt(),
      host: input.host,
      api: input.api,
      price: input.price,
      actualHost: input.actualHost ?? null,
      actualApi: input.actualApi ?? null
    }
  });

  return {
    id: created.id.toString(),
    host: created.host,
    api: created.api,
    price: Number(created.price),
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
      host: input.host,
      api: input.api,
      price: input.price,
      actualHost: input.actualHost ?? null,
      actualApi: input.actualApi ?? null
    }
  });

  return {
    id: updated.id.toString(),
    host: updated.host,
    api: updated.api,
    price: Number(updated.price),
    actualHost: updated.actualHost ?? null,
    actualApi: updated.actualApi ?? null
  } as ApiPricingItem;
}

export async function deleteApiPricing(id: string) {
  await prismaAny.apiPricing.delete({
    where: { id: BigInt(id) }
  });
}
