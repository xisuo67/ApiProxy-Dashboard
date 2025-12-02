import { PayCallbackClient } from './pay-callback-client';

export const metadata = {
  title: '支付结果'
};

type PageProps = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function PayCallbackPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const orderId = searchParams.orderId;

  return <PayCallbackClient orderId={orderId} />;
}
