import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';

export interface MiniProgramItem {
  id: string;
  userId: string;
  name: string;
  appid: string;
  isApproved: boolean;
  apiPricingIds: string[]; // 关联的服务商 ID 列表
  apiPricings?: Array<{ id: string; name: string; isEnabled: boolean }>; // 关联的服务商信息（用于显示）
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
  apiPricingIds?: string[]; // 关联的服务商 ID 列表
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

  // 获取所有相关的 ApiPricing 数据
  const allApiPricingIds = new Set<string>();
  (items as any[]).forEach((item: any) => {
    const ids = Array.isArray(item.apiPricingIds) ? item.apiPricingIds : [];
    ids.forEach((id: any) => allApiPricingIds.add(String(id)));
  });

  const apiPricingsMap = new Map<
    string,
    { id: string; name: string; isEnabled: boolean }
  >();
  if (allApiPricingIds.size > 0) {
    const apiPricings = await prismaAny.apiPricing.findMany({
      where: {
        id: {
          in: Array.from(allApiPricingIds).map((id) => BigInt(id))
        }
      },
      select: {
        id: true,
        name: true,
        isEnabled: true
      }
    });
    (apiPricings as any[]).forEach((pricing: any) => {
      apiPricingsMap.set(pricing.id.toString(), {
        id: pricing.id.toString(),
        name: pricing.name,
        isEnabled: pricing.isEnabled ?? true
      });
    });
  }

  const data: MiniProgramItem[] = (items as any[]).map((item: any) => {
    const ids = Array.isArray(item.apiPricingIds) ? item.apiPricingIds : [];
    const apiPricingIds = ids.map((id: any) => String(id));
    const apiPricings = apiPricingIds
      .map((id: string) => apiPricingsMap.get(id))
      .filter(
        (
          p: { id: string; name: string; isEnabled: boolean } | undefined
        ): p is { id: string; name: string; isEnabled: boolean } =>
          p !== undefined
      );

    return {
      id: item.id.toString(),
      userId: item.userId.toString(),
      name: item.name,
      appid: item.appid,
      isApproved: item.isApproved || false,
      apiPricingIds,
      apiPricings,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  });

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

  const ids = Array.isArray((item as any).apiPricingIds)
    ? (item as any).apiPricingIds
    : [];
  const apiPricingIds = ids.map((id: any): string => String(id));

  // 获取关联的服务商信息
  let apiPricings: Array<{ id: string; name: string; isEnabled: boolean }> = [];
  if (apiPricingIds.length > 0) {
    const apiPricingsData = await prismaAny.apiPricing.findMany({
      where: {
        id: {
          in: apiPricingIds.map((id: string) => BigInt(id))
        }
      },
      select: {
        id: true,
        name: true,
        isEnabled: true
      }
    });
    apiPricings = (apiPricingsData as any[]).map((pricing: any) => ({
      id: pricing.id.toString(),
      name: pricing.name,
      isEnabled: pricing.isEnabled ?? true
    }));
  }

  return {
    id: item.id.toString(),
    userId: item.userId.toString(),
    name: item.name,
    appid: item.appid,
    isApproved: item.isApproved || false,
    apiPricingIds,
    apiPricings,
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
  const apiPricingIds = input.apiPricingIds || [];

  const created = await prismaAny.miniProgramSettings.create({
    data: {
      id: generateIdBigInt(),
      userId: BigInt(userId),
      name: input.name.trim(),
      appid: input.appid.trim(),
      isApproved: input.isApproved ?? false,
      apiPricingIds: apiPricingIds.map((id) => BigInt(id))
    }
  });

  // 获取关联的服务商信息
  let apiPricings: Array<{ id: string; name: string; isEnabled: boolean }> = [];
  if (apiPricingIds.length > 0) {
    const apiPricingsData = await prismaAny.apiPricing.findMany({
      where: {
        id: {
          in: apiPricingIds.map((id) => BigInt(id))
        }
      },
      select: {
        id: true,
        name: true,
        isEnabled: true
      }
    });
    apiPricings = (apiPricingsData as any[]).map((pricing: any) => ({
      id: pricing.id.toString(),
      name: pricing.name,
      isEnabled: pricing.isEnabled ?? true
    }));
  }

  return {
    id: created.id.toString(),
    userId: created.userId.toString(),
    name: created.name,
    appid: created.appid,
    isApproved: created.isApproved || false,
    apiPricingIds,
    apiPricings,
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
  const updateData: any = {
    name: input.name.trim(),
    appid: input.appid.trim()
  };

  if (input.isApproved !== undefined) {
    updateData.isApproved = input.isApproved;
  }

  if (input.apiPricingIds !== undefined) {
    updateData.apiPricingIds = input.apiPricingIds.map((id) => BigInt(id));
  }

  const updated = await prismaAny.miniProgramSettings.update({
    where: { id: BigInt(id) },
    data: updateData
  });

  const apiPricingIds = input.apiPricingIds || [];

  // 获取关联的服务商信息
  let apiPricings: Array<{ id: string; name: string; isEnabled: boolean }> = [];
  if (apiPricingIds.length > 0) {
    const apiPricingsData = await prismaAny.apiPricing.findMany({
      where: {
        id: {
          in: apiPricingIds.map((id) => BigInt(id))
        }
      },
      select: {
        id: true,
        name: true,
        isEnabled: true
      }
    });
    apiPricings = (apiPricingsData as any[]).map((pricing: any) => ({
      id: pricing.id.toString(),
      name: pricing.name,
      isEnabled: pricing.isEnabled ?? true
    }));
  }

  return {
    id: updated.id.toString(),
    userId: updated.userId.toString(),
    name: updated.name,
    appid: updated.appid,
    isApproved: updated.isApproved || false,
    apiPricingIds,
    apiPricings,
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
 * 批量设置服务商
 */
export async function batchSetApiPricings(
  ids: string[],
  apiPricingIds: string[]
): Promise<void> {
  await prismaAny.miniProgramSettings.updateMany({
    where: {
      id: {
        in: ids.map((id) => BigInt(id))
      }
    },
    data: {
      apiPricingIds: apiPricingIds.map((id) => BigInt(id))
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

  return (items as any[]).map((item: any) => {
    const ids = Array.isArray(item.apiPricingIds) ? item.apiPricingIds : [];
    const apiPricingIds = ids.map((id: any) => String(id));
    return {
      id: item.id.toString(),
      userId: item.userId.toString(),
      name: item.name,
      appid: item.appid,
      isApproved: item.isApproved || false,
      apiPricingIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  });
}
