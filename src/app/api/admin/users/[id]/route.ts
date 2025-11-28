import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

async function assertAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false as const, status: 401, message: '未登录' };
  }

  const me = await prisma.user.findUnique({
    where: { clerkId: userId }
  });

  if (!me || me.role !== 'Admin') {
    return { ok: false as const, status: 403, message: '无权限操作' };
  }

  return { ok: true as const };
}

function getIdFromRequest(req: Request) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1] || '';
}

export async function PATCH(req: Request) {
  const authResult = await assertAdmin();
  if (!authResult.ok) {
    return Response.json(
      { message: authResult.message },
      { status: authResult.status }
    );
  }

  const id = getIdFromRequest(req);
  const body = await req.json();
  const { role, isActive } = body as {
    role?: string;
    isActive?: boolean;
  };

  try {
    const updated = await prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        ...(role && { role }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    return Response.json(
      {
        id: updated.id.toString(),
        role: updated.role,
        isActive: updated.isActive
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN_USER_PATCH_ERROR]', error);
    return Response.json({ message: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authResult = await assertAdmin();
  if (!authResult.ok) {
    return Response.json(
      { message: authResult.message },
      { status: authResult.status }
    );
  }

  const id = getIdFromRequest(req);

  try {
    await prisma.user.delete({
      where: { id: BigInt(id) }
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[ADMIN_USER_DELETE_ERROR]', error);
    return Response.json({ message: '删除用户失败' }, { status: 500 });
  }
}
