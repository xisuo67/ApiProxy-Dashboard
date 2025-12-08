import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * 增强 DATABASE_URL，确保包含连接池配置
 * 如果 DATABASE_URL 中没有 connection_limit 和 pool_timeout，则自动添加
 */
function getEnhancedDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not defined');
  }

  try {
    const urlObj = new URL(url);

    // 如果 URL 中没有 connection_limit，添加默认值 20
    if (!urlObj.searchParams.has('connection_limit')) {
      urlObj.searchParams.set('connection_limit', '20');
    }

    // 如果 URL 中没有 pool_timeout，添加默认值 20（秒）
    if (!urlObj.searchParams.has('pool_timeout')) {
      urlObj.searchParams.set('pool_timeout', '20');
    }

    return urlObj.toString();
  } catch (error) {
    // 如果 URL 解析失败，使用原始 URL
    console.warn(
      '[PRISMA_CONFIG] Failed to parse DATABASE_URL, using original:',
      error
    );
    return url;
  }
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: getEnhancedDatabaseUrl()
      }
    }
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
