import { createSetting, listSettings } from '@/lib/settings';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '10');
  const search = searchParams.get('search');

  try {
    const data = await listSettings({ page, perPage, search });
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
    console.error('[SETTINGS_GET_ERROR]', error);
    return NextResponse.json({ message: '获取系统设置失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value, description } = body as {
      key?: string;
      value?: string;
      description?: string | null;
    };

    if (!key || !value) {
      return NextResponse.json(
        { message: '键(key)和值(value)为必填项' },
        { status: 400 }
      );
    }

    const created = await createSetting({ key, value, description });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[SETTINGS_POST_ERROR]', error);
    return NextResponse.json({ message: '新增系统设置失败' }, { status: 500 });
  }
}
