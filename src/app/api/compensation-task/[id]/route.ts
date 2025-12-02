import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const prismaAny = prisma as any;

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

// 重置补偿任务为待处理（pending），清空重试次数和错误信息
export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, isAdmin } = await requireAdmin();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json(
        { message: '无权限，只有管理员可以重置补偿任务' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const id = params.id;
    if (!id) {
      return NextResponse.json({ message: '缺少任务 ID' }, { status: 400 });
    }

    const task = await prismaAny.compensationTask.findUnique({
      where: { id: BigInt(id) }
    });

    if (!task) {
      return NextResponse.json({ message: '补偿任务不存在' }, { status: 404 });
    }

    const updated = await prismaAny.compensationTask.update({
      where: { id: BigInt(id) },
      data: {
        status: 'pending',
        retryCount: 0,
        errorMessage: null
      }
    });

    return NextResponse.json(
      {
        id: updated.id.toString(),
        status: updated.status,
        retryCount: updated.retryCount,
        maxRetries: updated.maxRetries
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[COMPENSATION_TASK_RESET_ERROR]', {
      error: error?.message,
      stack: error?.stack
    });
    return NextResponse.json(
      { message: '重置补偿任务失败，请稍后重试' },
      { status: 500 }
    );
  }
}
