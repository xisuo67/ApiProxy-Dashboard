import { deleteMiniPrograms, approveMiniPrograms } from '@/lib/mini-program';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getMiniProgramById } from '@/lib/mini-program';

async function getCurrentUserInfo() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, clerkId: true, role: true }
  });

  return user
    ? {
        userId: user.id.toString(),
        clerkId: user.clerkId,
        isAdmin: user.role === 'Admin'
      }
    : null;
}

export async function DELETE(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { ids } = body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: '缺少要删除的ID列表' },
        { status: 400 }
      );
    }

    // 权限检查：非Admin用户只能删除自己的数据
    if (!userInfo.isAdmin) {
      for (const id of ids) {
        const item = await getMiniProgramById(id);
        if (!item || item.userId !== userInfo.userId) {
          return NextResponse.json(
            { message: '无权限删除部分或全部数据' },
            { status: 403 }
          );
        }
      }
    }

    await deleteMiniPrograms(ids);
    return NextResponse.json({ message: '批量删除成功' }, { status: 200 });
  } catch (error) {
    console.error('[MINI_PROGRAM_BATCH_DELETE_ERROR]', error);
    return NextResponse.json({ message: '批量删除失败' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    // 只有Admin用户可以批量审核
    if (!userInfo.isAdmin) {
      return NextResponse.json(
        { message: '只有管理员可以批量审核' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { ids, isApproved } = body as {
      ids?: string[];
      isApproved?: boolean;
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: '缺少要审核的ID列表' },
        { status: 400 }
      );
    }

    if (isApproved === undefined) {
      return NextResponse.json({ message: '缺少审核状态' }, { status: 400 });
    }

    await approveMiniPrograms(ids, isApproved);
    return NextResponse.json(
      { message: `批量${isApproved ? '审核通过' : '取消审核'}成功` },
      { status: 200 }
    );
  } catch (error) {
    console.error('[MINI_PROGRAM_BATCH_APPROVE_ERROR]', error);
    return NextResponse.json({ message: '批量审核失败' }, { status: 500 });
  }
}
