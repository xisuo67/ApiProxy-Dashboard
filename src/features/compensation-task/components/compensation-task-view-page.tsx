import { searchParamsCache } from '@/lib/searchparams';
import { CompensationTaskTable } from './compensation-task-table';

export default async function CompensationTaskViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const status = searchParamsCache.get('status');

  return (
    <CompensationTaskTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      status={status ?? 'all'}
    />
  );
}
