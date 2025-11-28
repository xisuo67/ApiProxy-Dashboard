import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export interface ListSettingsParams {
  page?: number | null;
  perPage?: number | null;
  search?: string | null;
}

export async function listSettings(params: ListSettingsParams) {
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
            { key: { contains: search } },
            { description: { contains: search } }
          ]
        }
      : {};

  const [items, total] = await Promise.all([
    prisma.setting.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'desc' }
    }),
    prisma.setting.count({ where })
  ]);

  const data: Setting[] = items.map((item) => ({
    id: item.id.toString(),
    key: item.key,
    value: item.value,
    description: item.description ?? null
  }));

  return { items: data, total, page, perPage };
}

export interface UpsertSettingInput {
  key: string;
  value: string;
  description?: string | null;
}

export async function createSetting(
  input: UpsertSettingInput
): Promise<Setting> {
  const created = await prisma.setting.create({
    data: {
      id: generateIdBigInt(),
      key: input.key,
      value: input.value,
      description: input.description ?? null
    }
  });

  return {
    id: created.id.toString(),
    key: created.key,
    value: created.value,
    description: created.description ?? null
  };
}

export async function updateSetting(
  id: string,
  input: UpsertSettingInput
): Promise<Setting> {
  const updated = await prisma.setting.update({
    where: { id: BigInt(id) },
    data: {
      key: input.key,
      value: input.value,
      description: input.description ?? null
    }
  });

  return {
    id: updated.id.toString(),
    key: updated.key,
    value: updated.value,
    description: updated.description ?? null
  };
}

export async function deleteSetting(id: string): Promise<void> {
  await prisma.setting.delete({
    where: { id: BigInt(id) }
  });
}
