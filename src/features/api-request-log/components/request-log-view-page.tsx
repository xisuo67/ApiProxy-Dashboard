import { searchParamsCache } from '@/lib/searchparams';
import { RequestLogTable } from './request-log-table';

export default async function RequestLogViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const startDate = searchParamsCache.get('startDate');
  const endDate = searchParamsCache.get('endDate');

  return (
    <RequestLogTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      startDate={startDate ?? ''}
      endDate={endDate ?? ''}
    />
  );
}
