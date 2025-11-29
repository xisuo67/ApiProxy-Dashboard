import { listApiPricing, createApiPricing } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: '未登录' }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { clerkId: userId }
  });

  if (!me || me.role !== 'Admin') {
    return NextResponse.json(
      { message: '无权限，只有管理员可以执行此操作' },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '10');
  const search = searchParams.get('search');

  try {
    const data = await listApiPricing({ page, perPage, search });
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
    console.error('[PRICING_GET_ERROR]', error);
    return NextResponse.json({ message: '获取定价数据失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const body = await req.json();
    const { name, host, api, price, actualHost, actualApi } = body as {
      name?: string;
      host?: string;
      api?: string;
      price?: number;
      actualHost?: string | null;
      actualApi?: string | null;
    };

    if (!name || !host || !api || price == null) {
      return NextResponse.json(
        { message: 'name、host、api 和 price 为必填项' },
        { status: 400 }
      );
    }

    const created = await createApiPricing({
      name: name.trim(),
      host: host.trim(),
      api: api.trim(),
      price: Number(price),
      actualHost: actualHost ? actualHost.trim() : null,
      actualApi: actualApi ? actualApi.trim() : null
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[PRICING_POST_ERROR]', error);
    return NextResponse.json({ message: '新增定价失败' }, { status: 500 });
  }
}
