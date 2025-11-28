import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ message: '未登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId }
  });

  return Response.json(
    {
      role: user?.role ?? 'User',
      isActive: user?.isActive ?? true
    },
    { status: 200 }
  );
}
