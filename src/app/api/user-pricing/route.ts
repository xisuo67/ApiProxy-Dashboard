import { getUserPricings, createUserPricing } from '@/lib/user-pricing';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

async function getCurrentUserId() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true }
  });

  return user ? user.id.toString() : null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const data = await getUserPricings(userId);
    return NextResponse.json({ items: data }, { status: 200 });
  } catch (error) {
    console.error('[USER_PRICING_GET_ERROR]', error);
    return NextResponse.json(
      { message: '获取用户服务商关联失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { apiPricingId } = body as {
      apiPricingId?: string;
    };

    if (!apiPricingId) {
      return NextResponse.json(
        { message: 'apiPricingId 为必填项' },
        { status: 400 }
      );
    }

    const created = await createUserPricing(userId, apiPricingId);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('[USER_PRICING_POST_ERROR]', {
      userId,
      apiPricingId,
      error: error.message,
      stack: error.stack
    });
    // 不暴露内部错误信息，只返回友好的错误提示
    const userMessage = error.message?.includes('已关联')
      ? error.message // 业务逻辑错误（如重复关联）可以显示
      : '创建服务商关联失败，请稍后重试';
    return NextResponse.json({ message: userMessage }, { status: 500 });
  }
}
