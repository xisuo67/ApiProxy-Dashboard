import { updateApiPricing, deleteApiPricing } from '@/lib/pricing';
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

function getIdFromRequest(req: NextRequest): string {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1] || '';
}

export async function PUT(req: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json({ message: '缺少定价 ID' }, { status: 400 });
    }

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

    const updated = await updateApiPricing(id, {
      name: name.trim(),
      host: host.trim(),
      api: api.trim(),
      price: Number(price),
      actualHost: actualHost ? actualHost.trim() : null,
      actualApi: actualApi ? actualApi.trim() : null
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[PRICING_PUT_ERROR]', error);
    return NextResponse.json({ message: '更新定价失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json({ message: '缺少定价 ID' }, { status: 400 });
    }

    await deleteApiPricing(id);

    return NextResponse.json(
      { message: '删除成功' },
      {
        status: 200
      }
    );
  } catch (error) {
    console.error('[PRICING_DELETE_ERROR]', error);
    return NextResponse.json({ message: '删除定价失败' }, { status: 500 });
  }
}
