import { searchParamsCache } from '@/lib/searchparams';
import { MiniProgramTable } from './mini-program-table';

export default async function MiniProgramViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const search = searchParamsCache.get('search');
  const isApproved = searchParamsCache.get('isApproved');

  return (
    <MiniProgramTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      search={search ?? ''}
      isApproved={isApproved ?? null}
    />
  );
}
