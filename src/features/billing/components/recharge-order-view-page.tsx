import { searchParamsCache } from '@/lib/searchparams';
import { RechargeOrderTable } from './recharge-order-table';

export default async function RechargeOrderViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const status = searchParamsCache.get('status');
  const startDate = searchParamsCache.get('startDate');
  const endDate = searchParamsCache.get('endDate');

  return (
    <RechargeOrderTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      status={status ?? undefined}
      startDate={startDate ?? undefined}
      endDate={endDate ?? undefined}
    />
  );
}
