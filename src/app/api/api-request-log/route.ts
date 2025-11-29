import { listApiRequestLog, exportApiRequestLog } from '@/lib/api-request-log';
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const exportData = searchParams.get('export') === 'true';

    // 如果是导出请求，返回所有数据
    if (exportData) {
      const data = await exportApiRequestLog({
        startDate,
        endDate,
        userClerkId: userInfo.clerkId,
        isAdmin: userInfo.isAdmin
      });
      return NextResponse.json({ items: data }, { status: 200 });
    }

    // 列表查询
    const data = await listApiRequestLog({
      page,
      perPage,
      startDate,
      endDate,
      userClerkId: userInfo.clerkId,
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
    console.error('[API_REQUEST_LOG_GET_ERROR]', error);
    return NextResponse.json({ message: '获取请求日志失败' }, { status: 500 });
  }
}
