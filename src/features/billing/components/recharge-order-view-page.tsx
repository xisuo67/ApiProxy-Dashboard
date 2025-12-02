import { searchParamsCache } from '@/lib/searchparams';
import { RechargeOrderTable } from './recharge-order-table';

// 获取当月开始和结束日期
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    startDate: start.toISOString().split('T')[0], // YYYY-MM-DD
    endDate: end.toISOString().split('T')[0] // YYYY-MM-DD
  };
}

export default async function RechargeOrderViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const status = searchParamsCache.get('status');
  const startDate = searchParamsCache.get('startDate');
  const endDate = searchParamsCache.get('endDate');

  // 如果没有指定日期范围，默认使用当月
  const monthRange = getCurrentMonthRange();
  const defaultStartDate = startDate ?? monthRange.startDate;
  const defaultEndDate = endDate ?? monthRange.endDate;

  return (
    <RechargeOrderTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      status={status ?? undefined}
      startDate={defaultStartDate}
      endDate={defaultEndDate}
    />
  );
}
