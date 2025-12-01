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

// 批量重置补偿任务为待处理（pending），清空重试次数和错误信息
export async function POST(req: NextRequest) {
  try {
    const { userId, isAdmin } = await requireAdmin();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json(
        { message: '无权限，只有管理员可以批量重置补偿任务' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const ids = (body?.ids as string[] | null) || [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: '缺少任务 ID 列表' },
        { status: 400 }
      );
    }

    const bigIntIds = ids.map((id) => BigInt(id));

    const result = await prismaAny.compensationTask.updateMany({
      where: {
        id: { in: bigIntIds },
        status: 'failed'
      },
      data: {
        status: 'pending',
        retryCount: 0,
        errorMessage: null
      }
    });

    return NextResponse.json(
      {
        requested: ids.length,
        updated: result.count
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[COMPENSATION_TASK_BATCH_RESET_ERROR]', {
      error: error?.message,
      stack: error?.stack
    });
    return NextResponse.json(
      { message: '批量重置补偿任务失败，请稍后重试' },
      { status: 500 }
    );
  }
}
