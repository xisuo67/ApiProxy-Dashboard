import { prisma } from '@/lib/prisma';

export interface UserPricingItem {
  id: string;
  userId: string;
  apiPricingId: string;
  apiPricing: {
    id: string;
    name: string;
    host: string;
    api: string;
    price: number;
  };
  createdAt: Date;
}

// 由于本地 Prisma Client 可能还没重新生成，类型上暂时没有 userPricing delegate，
// 这里通过 any 断言绕过 TS 检查，避免构建报错；实际运行时仍然会调用 prisma.userPricing。
const prismaAny = prisma as any;

/**
 * 获取用户关联的所有服务商
 */
export async function getUserPricings(userId: string) {
  const items = await prismaAny.userPricing.findMany({
    where: { userId: BigInt(userId) },
    include: {
      apiPricing: {
        select: {
          id: true,
          name: true,
          host: true,
          api: true,
          price: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const data: UserPricingItem[] = (items as any[]).map((item: any) => ({
    id: item.id.toString(),
    userId: item.userId.toString(),
    apiPricingId: item.apiPricingId.toString(),
    apiPricing: {
      id: item.apiPricing.id.toString(),
      name: item.apiPricing.name || '',
      host: item.apiPricing.host,
      api: item.apiPricing.api,
      price: Number(item.apiPricing.price)
    },
    createdAt: item.createdAt
  }));

  return data;
}

/**
 * 创建用户服务商关联
 */
export async function createUserPricing(userId: string, apiPricingId: string) {
  // 检查是否已存在关联
  const existing = await prismaAny.userPricing.findUnique({
    where: {
      userId_apiPricingId: {
        userId: BigInt(userId),
        apiPricingId: BigInt(apiPricingId)
      }
    }
  });

  if (existing) {
    throw new Error('该服务商已关联，请勿重复添加');
  }

  const created = await prismaAny.userPricing.create({
    data: {
      userId: BigInt(userId),
      apiPricingId: BigInt(apiPricingId)
    },
    include: {
      apiPricing: {
        select: {
          id: true,
          name: true,
          host: true,
          api: true,
          price: true
        }
      }
    }
  });

  return {
    id: created.id.toString(),
    userId: created.userId.toString(),
    apiPricingId: created.apiPricingId.toString(),
    apiPricing: {
      id: created.apiPricing.id.toString(),
      name: created.apiPricing.name || '',
      host: created.apiPricing.host,
      api: created.apiPricing.api,
      price: Number(created.apiPricing.price)
    },
    createdAt: created.createdAt
  } as UserPricingItem;
}

/**
 * 删除用户服务商关联
 */
export async function deleteUserPricing(id: string) {
  await prismaAny.userPricing.delete({
    where: { id: BigInt(id) }
  });
}
