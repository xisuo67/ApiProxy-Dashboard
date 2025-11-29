import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';

export interface MiniProgramItem {
  id: string;
  userId: string;
  name: string;
  appid: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListMiniProgramParams {
  page?: number | null;
  perPage?: number | null;
  search?: string | null;
  isApproved?: boolean | null; // 审核状态筛选
  userId?: string | null; // 如果提供，只查询该用户的数据；如果为 null 且 isAdmin，查询所有
  isAdmin?: boolean;
}

export interface UpsertMiniProgramInput {
  name: string;
  appid: string;
  isApproved?: boolean;
}

const prismaAny = prisma as any;

/**
 * 获取小程序列表
 */
export async function listMiniProgram(params: ListMiniProgramParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const perPage =
    params.perPage && params.perPage > 0 && params.perPage <= 100
      ? params.perPage
      : 10;

  const where: any = {};

  // 权限过滤：非Admin用户只能看自己的数据
  if (!params.isAdmin && params.userId) {
    where.userId = BigInt(params.userId);
  }
  // Admin用户不限制 userId，可以看所有数据

  // 搜索功能：支持名称和 appid 搜索
  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { appid: { contains: params.search } }
    ];
  }

  // 审核状态筛选
  if (params.isApproved !== null && params.isApproved !== undefined) {
    where.isApproved = params.isApproved;
  }

  const [items, total] = await Promise.all([
    prismaAny.miniProgramSettings.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' }
    }),
    prismaAny.miniProgramSettings.count({ where })
  ]);

  const data: MiniProgramItem[] = (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    userId: item.userId.toString(),
    name: item.name,
    appid: item.appid,
    isApproved: item.isApproved || false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  return { items: data, total, page, perPage };
}

/**
 * 获取单个小程序配置
 */
export async function getMiniProgramById(
  id: string
): Promise<MiniProgramItem | null> {
  const item = await prismaAny.miniProgramSettings.findUnique({
    where: { id: BigInt(id) }
  });

  if (!item) return null;

  return {
    id: item.id.toString(),
    userId: item.userId.toString(),
    name: item.name,
    appid: item.appid,
    isApproved: item.isApproved || false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

/**
 * 创建小程序配置
 */
export async function createMiniProgram(
  userId: string,
  input: UpsertMiniProgramInput
): Promise<MiniProgramItem> {
  const created = await prismaAny.miniProgramSettings.create({
    data: {
      id: generateIdBigInt(),
      userId: BigInt(userId),
      name: input.name.trim(),
      appid: input.appid.trim(),
      isApproved: input.isApproved ?? false
    }
  });

  return {
    id: created.id.toString(),
    userId: created.userId.toString(),
    name: created.name,
    appid: created.appid,
    isApproved: created.isApproved || false,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt
  };
}

/**
 * 更新小程序配置
 */
export async function updateMiniProgram(
  id: string,
  input: UpsertMiniProgramInput
): Promise<MiniProgramItem> {
  const updated = await prismaAny.miniProgramSettings.update({
    where: { id: BigInt(id) },
    data: {
      name: input.name.trim(),
      appid: input.appid.trim(),
      ...(input.isApproved !== undefined && { isApproved: input.isApproved })
    }
  });

  return {
    id: updated.id.toString(),
    userId: updated.userId.toString(),
    name: updated.name,
    appid: updated.appid,
    isApproved: updated.isApproved || false,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  };
}

/**
 * 删除小程序配置
 */
export async function deleteMiniProgram(id: string): Promise<void> {
  await prismaAny.miniProgramSettings.delete({
    where: { id: BigInt(id) }
  });
}

/**
 * 批量删除小程序配置
 */
export async function deleteMiniPrograms(ids: string[]): Promise<void> {
  await prismaAny.miniProgramSettings.deleteMany({
    where: {
      id: {
        in: ids.map((id) => BigInt(id))
      }
    }
  });
}

/**
 * 批量审核小程序配置
 */
export async function approveMiniPrograms(
  ids: string[],
  isApproved: boolean
): Promise<void> {
  await prismaAny.miniProgramSettings.updateMany({
    where: {
      id: {
        in: ids.map((id) => BigInt(id))
      }
    },
    data: {
      isApproved
    }
  });
}

/**
 * 导出小程序配置（用于CSV导出，不限制数量）
 */
export async function exportMiniProgram(params: {
  search?: string | null;
  isApproved?: boolean | null;
  userId?: string | null;
  isAdmin?: boolean;
}): Promise<MiniProgramItem[]> {
  const where: any = {};

  // 权限过滤
  if (!params.isAdmin && params.userId) {
    where.userId = BigInt(params.userId);
  }

  // 搜索功能
  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { appid: { contains: params.search } }
    ];
  }

  // 审核状态筛选
  if (params.isApproved !== null && params.isApproved !== undefined) {
    where.isApproved = params.isApproved;
  }

  const items = await prismaAny.miniProgramSettings.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    userId: item.userId.toString(),
    name: item.name,
    appid: item.appid,
    isApproved: item.isApproved || false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}
