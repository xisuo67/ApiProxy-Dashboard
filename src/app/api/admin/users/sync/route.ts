import { auth } from '@clerk/nextjs/server';
import { syncAllUsersFromClerk } from '@/lib/user-sync';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ message: '未登录' }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { clerkId: userId }
  });

  if (!me || me.role !== 'Admin') {
    return Response.json({ message: '无权限执行同步' }, { status: 403 });
  }

  const result = await syncAllUsersFromClerk();

  return Response.json(result, { status: 200 });
}
