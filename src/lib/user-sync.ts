import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export type UserRole = 'Admin' | 'User';

export async function syncUserIfNeeded(clerkUserId: string) {
  if (!clerkUserId) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId }
  });

  if (existing) {
    return existing;
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return existing;
  }

  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    clerkUser.primaryEmailAddress?.emailAddress ??
    null;

  return prisma.user.create({
    data: {
      clerkId: clerkUser.id,
      email: email ?? undefined,
      name:
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        clerkUser.username ||
        email ||
        '',
      avatarUrl: clerkUser.imageUrl,
      role: 'User'
    }
  });
}

export async function syncAllUsersFromClerk() {
  const pageSize = 100;
  let offset = 0;
  let totalSynced = 0;

  // 简单的分页全量同步，适合用户量不大的场景
  // 大量用户时建议改为基于 cursor 的增量同步
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const list = await clerkClient.users.getUserList({
      limit: pageSize,
      offset
    });

    if (list.length === 0) break;

    for (const u of list) {
      const email =
        u.emailAddresses[0]?.emailAddress ??
        u.primaryEmailAddress?.emailAddress ??
        null;

      await prisma.user.upsert({
        where: { clerkId: u.id },
        create: {
          clerkId: u.id,
          email: email ?? undefined,
          name:
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
            u.username ||
            email ||
            '',
          avatarUrl: u.imageUrl,
          role: 'User'
        },
        update: {
          email: email ?? undefined,
          name:
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
            u.username ||
            email ||
            '',
          avatarUrl: u.imageUrl
        }
      });

      totalSynced += 1;
    }

    if (list.length < pageSize) break;
    offset += pageSize;
  }

  return { totalSynced };
}
