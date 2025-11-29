import {
  listMiniProgram,
  createMiniProgram,
  exportMiniProgram
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

export async function GET(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get('page') ?? '1');
    const perPage = Number(searchParams.get('perPage') ?? '10');
    const search = searchParams.get('search');
    const isApprovedParam = searchParams.get('isApproved');
    const isApproved =
      isApprovedParam === 'true'
        ? true
        : isApprovedParam === 'false'
          ? false
          : null;
    const exportData = searchParams.get('export') === 'true';

    // 如果是导出请求，返回所有数据
    if (exportData) {
      const data = await exportMiniProgram({
        search,
        isApproved,
        userId: userInfo.userId,
        isAdmin: userInfo.isAdmin
      });
      return NextResponse.json({ items: data }, { status: 200 });
    }

    // 列表查询
    const data = await listMiniProgram({
      page,
      perPage,
      search,
      isApproved,
      userId: userInfo.userId,
      isAdmin: userInfo.isAdmin
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
    console.error('[MINI_PROGRAM_GET_ERROR]', error);
    return NextResponse.json(
      { message: '获取小程序配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
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

    // 非Admin用户不能设置审核状态
    const approvedStatus = userInfo.isAdmin ? (isApproved ?? false) : false;

    const created = await createMiniProgram(userInfo.userId, {
      name: name.trim(),
      appid: appid.trim(),
      isApproved: approvedStatus
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[MINI_PROGRAM_POST_ERROR]', error);
    return NextResponse.json(
      { message: '创建小程序配置失败' },
      { status: 500 }
    );
  }
}
