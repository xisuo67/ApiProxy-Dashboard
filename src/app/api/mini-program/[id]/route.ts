import {
  getMiniProgramById,
  updateMiniProgram,
  deleteMiniProgram
} from '@/lib/mini-program';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

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

function getIdFromRequest(req: Request) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1] || '';
}

export async function GET(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json(
        { message: '缺少小程序配置 ID' },
        { status: 400 }
      );
    }

    const item = await getMiniProgramById(id);
    if (!item) {
      return NextResponse.json(
        { message: '小程序配置不存在' },
        { status: 404 }
      );
    }

    // 权限检查：非Admin用户只能查看自己的数据
    if (!userInfo.isAdmin && item.userId !== userInfo.userId) {
      return NextResponse.json({ message: '无权限访问' }, { status: 403 });
    }

    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    console.error('[MINI_PROGRAM_GET_ERROR]', error);
    return NextResponse.json(
      { message: '获取小程序配置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json(
        { message: '缺少小程序配置 ID' },
        { status: 400 }
      );
    }

    // 检查权限：先获取原数据
    const existing = await getMiniProgramById(id);
    if (!existing) {
      return NextResponse.json(
        { message: '小程序配置不存在' },
        { status: 404 }
      );
    }

    // 非Admin用户只能修改自己的数据
    if (!userInfo.isAdmin && existing.userId !== userInfo.userId) {
      return NextResponse.json({ message: '无权限修改' }, { status: 403 });
    }

    const body = await req.json();
    const { name, appid, isApproved } = body as {
      name?: string;
      appid?: string;
      isApproved?: boolean;
    };

    if (!name || !appid) {
      return NextResponse.json(
        { message: 'name 和 appid 为必填项' },
        { status: 400 }
      );
    }

    // 非Admin用户不能修改审核状态
    const updateData: any = {
      name: name.trim(),
      appid: appid.trim()
    };

    if (userInfo.isAdmin && isApproved !== undefined) {
      updateData.isApproved = isApproved;
    }

    const updated = await updateMiniProgram(id, updateData);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[MINI_PROGRAM_PUT_ERROR]', error);
    return NextResponse.json(
      { message: '更新小程序配置失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json(
        { message: '缺少小程序配置 ID' },
        { status: 400 }
      );
    }

    // 检查权限
    const existing = await getMiniProgramById(id);
    if (!existing) {
      return NextResponse.json(
        { message: '小程序配置不存在' },
        { status: 404 }
      );
    }

    // 非Admin用户只能删除自己的数据
    if (!userInfo.isAdmin && existing.userId !== userInfo.userId) {
      return NextResponse.json({ message: '无权限删除' }, { status: 403 });
    }

    await deleteMiniProgram(id);
    return NextResponse.json({ message: '删除成功' }, { status: 200 });
  } catch (error) {
    console.error('[MINI_PROGRAM_DELETE_ERROR]', error);
    return NextResponse.json(
      { message: '删除小程序配置失败' },
      { status: 500 }
    );
  }
}
