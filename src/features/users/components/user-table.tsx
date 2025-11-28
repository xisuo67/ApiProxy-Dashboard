import { prisma } from '@/lib/prisma';
import { UserTableClient } from './user-table-client';
import { auth } from '@clerk/nextjs/server';

export async function UserTable() {
  const { userId } = await auth();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  let isAdmin = false;

  if (userId) {
    const me = await prisma.user.findUnique({
      where: { clerkId: userId }
    });
    isAdmin = me?.role === 'Admin';
  }

  const data = users.map((u) => ({
    id: u.id.toString(),
    clerkId: u.clerkId,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isActive: u.isActive
  }));

  return (
    <UserTableClient data={data} totalItems={users.length} isAdmin={isAdmin} />
  );
}
