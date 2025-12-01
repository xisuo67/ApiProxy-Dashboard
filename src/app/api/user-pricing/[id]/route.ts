import { deleteUserPricing } from '@/lib/user-pricing';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

async function getCurrentUserId() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true }
  });

  return user ? user.id.toString() : null;
}

function getIdFromRequest(req: NextRequest): string {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1] || '';
}

export async function DELETE(req: NextRequest) {
  let userId: string | null = null;
  let id: string | null = null;

  try {
    userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json({ message: '缺少关联 ID' }, { status: 400 });
    }

    // 验证该关联属于当前用户
    const prismaAny = prisma as any;
    const item = await prismaAny.userPricing.findUnique({
      where: { id: BigInt(id) }
    });

    if (!item) {
      return NextResponse.json({ message: '关联不存在' }, { status: 404 });
    }

    if (item.userId.toString() !== userId) {
      return NextResponse.json({ message: '无权限操作' }, { status: 403 });
    }

    await deleteUserPricing(id);
    return NextResponse.json({ message: '删除成功' }, { status: 200 });
  } catch (error: any) {
    console.error('[USER_PRICING_DELETE_ERROR]', {
      id: id ?? getIdFromRequest(req),
      userId,
      error: error.message,
      stack: error.stack
    });
    // 不暴露内部错误信息，只返回友好的错误提示
    const userMessage =
      error.message?.includes('不存在') || error.message?.includes('无权限')
        ? error.message // 业务逻辑错误（如不存在、无权限）可以显示
        : '删除服务商关联失败，请稍后重试';
    return NextResponse.json({ message: userMessage }, { status: 500 });
  }
}
