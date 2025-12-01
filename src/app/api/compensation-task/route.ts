import { listCompensationTasks } from '@/lib/compensation-task-list';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { userId: null, isAdmin: false } as const;
  }

  const me = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true }
  });

  return {
    userId,
    isAdmin: me?.role === 'Admin'
  } as const;
}

export async function GET(req: NextRequest) {
  try {
    const { userId, isAdmin } = await requireAdmin();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json(
        { message: '无权限，只有管理员可以查看补偿任务' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get('page') ?? '1');
    const perPage = Number(searchParams.get('perPage') ?? '10');
    const statusParam = searchParams.get('status');
    const status =
      statusParam === 'pending' ||
      statusParam === 'processing' ||
      statusParam === 'completed' ||
      statusParam === 'failed' ||
      statusParam === 'all'
        ? statusParam
        : 'all';

    const data = await listCompensationTasks({
      page,
      perPage,
      status
    });

    return NextResponse.json(
      {
        items: data.items,
        total: data.total,
        page: data.page,
        perPage: data.perPage
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[COMPENSATION_TASK_LIST_ERROR]', error);
    return NextResponse.json(
      { message: '获取补偿任务列表失败' },
      { status: 500 }
    );
  }
}
