import { searchParamsCache } from '@/lib/searchparams';
import { PricingTable } from './pricing-table';

export default async function PricingViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const search = searchParamsCache.get('search');

  return (
    <PricingTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      search={search ?? ''}
    />
  );
}
