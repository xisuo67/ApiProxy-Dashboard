import { deleteSetting, updateSetting } from '@/lib/settings';
import { NextRequest, NextResponse } from 'next/server';

function getIdFromRequest(req: NextRequest): string {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1] || '';
}

export async function PUT(req: NextRequest) {
  try {
    const id = getIdFromRequest(req);
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

    const updated = await updateSetting(id, { key, value, description });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[SETTINGS_PUT_ERROR]', error);
    return NextResponse.json({ message: '更新系统设置失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromRequest(req);
    await deleteSetting(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[SETTINGS_DELETE_ERROR]', error);
    return NextResponse.json({ message: '删除系统设置失败' }, { status: 500 });
  }
}
