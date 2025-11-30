import {
  updateApiPricing,
  deleteApiPricing,
  getApiPricingById
} from '@/lib/pricing';
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

export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const id = getIdFromRequest(req);
    if (!id) {
      return NextResponse.json({ message: '缺少定价 ID' }, { status: 400 });
    }

    const item = await getApiPricingById(id);
    if (!item) {
      return NextResponse.json({ message: '定价配置不存在' }, { status: 404 });
    }

    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    console.error('[PRICING_GET_ERROR]', error);
    return NextResponse.json({ message: '获取定价配置失败' }, { status: 500 });
  }
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
    const { name, host, api, price, apiKey, actualHost, actualApi, isEnabled } =
      body as {
        name?: string;
        host?: string;
        api?: string;
        price?: number;
        apiKey?: string | null;
        actualHost?: string | null;
        actualApi?: string | null;
        isEnabled?: boolean;
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
      apiKey: apiKey ? apiKey.trim() : null,
      actualHost: actualHost ? actualHost.trim() : null,
      actualApi: actualApi ? actualApi.trim() : null,
      isEnabled: isEnabled ?? true
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
  } catch (error: any) {
    console.error('[PRICING_DELETE_ERROR]', error);

    // 如果是业务逻辑错误（有关联记录），返回 400 状态码和具体错误信息
    if (error.message && error.message.includes('无法删除')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: '删除服务商失败' }, { status: 500 });
  }
}
