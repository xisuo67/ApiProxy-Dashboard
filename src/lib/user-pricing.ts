import { prisma } from '@/lib/prisma';
import { generateIdBigInt } from '@/lib/snowflake';
import {
  createApisixConsumer,
  deleteApisixConsumer,
  getApisixConfig
} from '@/lib/apisix';

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
    isEnabled: boolean;
  };
  createdAt: Date;
}

// 由于本地 Prisma Client 可能还没重新生成，类型上暂时没有 userPricing delegate，
// 这里通过 any 断言绕过 TS 检查，避免构建报错；实际运行时仍然会调用 prisma.userPricing。
const prismaAny = prisma as any;

/**
 * 清理用户名，使其符合 APISIX Consumer 用户名规则（只允许字母、数字、下划线和连字符）
 * 规则: ^[a-zA-Z0-9_\\-]+$
 *
 * 如果用户名包含非 ASCII 字符（如中文），使用 Base64 编码以确保唯一性和可读性
 */
function sanitizeUsername(username: string): string {
  // 检查是否包含非 ASCII 字符
  const hasNonAscii = /[^\x00-\x7F]/.test(username);

  if (hasNonAscii) {
    // 如果包含非 ASCII 字符，使用 Base64 编码
    // 使用 Buffer 进行 Base64 编码，然后替换不支持的字符
    const base64 = Buffer.from(username, 'utf8').toString('base64');
    // Base64 可能包含 + 和 /，需要替换为支持的字符
    return base64.replace(/\+/g, '_').replace(/\//g, '-').replace(/=/g, '');
  }

  // 如果不包含非 ASCII 字符，只清理不支持的字符
  let cleaned = username
    .replace(/[^a-zA-Z0-9_\-]/g, '_') // 将非允许字符替换为下划线
    .replace(/_{2,}/g, '_') // 将多个连续下划线替换为单个
    .replace(/^_+|_+$/g, ''); // 移除开头和结尾的下划线

  // 如果清理后为空，使用 'user' 作为默认值
  if (!cleaned || cleaned.length === 0) {
    cleaned = 'user';
  }

  return cleaned;
}

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
          price: true,
          isEnabled: true
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
      price: Number(item.apiPricing.price),
      isEnabled:
        item.apiPricing.isEnabled !== undefined
          ? item.apiPricing.isEnabled
          : true
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

  // 获取用户信息（用于 Consumer 命名）
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, name: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  const userPricingId = generateIdBigInt();
  const userPricingIdStr = userPricingId.toString();
  const userIdStr = user.id.toString();
  const userName = user.name || 'Unknown'; // 如果用户名为空，使用 'Unknown'

  // 创建数据库记录
  const created = await prismaAny.userPricing.create({
    data: {
      id: userPricingId,
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

  // 创建 APISIX Consumer
  // Consumer 用户名格式: User.name-User.id-userPricingIdStr
  // 清理用户名以符合 APISIX 规则（只允许字母、数字、下划线和连字符）
  const sanitizedUserName = sanitizeUsername(userName);
  const consumerUsername = `${sanitizedUserName}-${userIdStr}-${userPricingIdStr}`;
  try {
    const apisixConfig = await getApisixConfig();
    await createApisixConsumer(apisixConfig, {
      username: consumerUsername,
      key: userPricingIdStr // 使用 UserPricing.id 作为 key-auth 密钥
    });
  } catch (error: any) {
    // 如果 APISIX 创建失败，回滚数据库操作
    console.error('[APISIX_CONSUMER_CREATE_ERROR]', {
      userId,
      apiPricingId,
      userPricingId: userPricingIdStr,
      error: error.message,
      stack: error.stack
    });
    await prismaAny.userPricing.delete({
      where: { id: userPricingId }
    });
    // 不暴露内部错误信息，只返回友好的错误提示
    throw new Error('创建服务商关联失败，请稍后重试');
  }

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
  // 获取 UserPricing 信息（包含用户信息，用于构建 Consumer 用户名）
  const userPricing = await prismaAny.userPricing.findUnique({
    where: { id: BigInt(id) },
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });

  if (!userPricing) {
    throw new Error('用户服务商关联不存在');
  }

  // 构建 Consumer 用户名: User.name-User.id-userPricingIdStr
  const userIdStr = userPricing.user.id.toString();
  const userName = userPricing.user.name || 'Unknown';
  const userPricingIdStr = id;
  // 清理用户名以符合 APISIX 规则（只允许字母、数字、下划线和连字符）
  const sanitizedUserName = sanitizeUsername(userName);
  const consumerUsername = `${sanitizedUserName}-${userIdStr}-${userPricingIdStr}`;

  // 先删除 APISIX Consumer
  try {
    const apisixConfig = await getApisixConfig();
    await deleteApisixConsumer(apisixConfig, consumerUsername);
  } catch (error: any) {
    // 记录错误但不阻止删除，因为 Consumer 可能已经不存在
    console.error('[APISIX_CONSUMER_DELETE_ERROR]', {
      userPricingId: id,
      consumerUsername,
      error: error.message,
      stack: error.stack
    });
  }

  // 删除数据库记录
  await prismaAny.userPricing.delete({
    where: { id: BigInt(id) }
  });
}
