import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PayCallbackClient } from './pay-callback-client';

export const metadata = {
  title: '支付结果'
};

type PageProps = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function PayCallbackPage(props: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  const searchParams = await props.searchParams;
  const orderId = searchParams.orderId;

  return <PayCallbackClient orderId={orderId} />;
}
