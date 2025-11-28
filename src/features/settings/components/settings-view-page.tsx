import { searchParamsCache } from '@/lib/searchparams';
import { SettingsTable } from './settings-table';

export default async function SettingsViewPage() {
  const page = searchParamsCache.get('page');
  const perPage = searchParamsCache.get('perPage');
  const search = searchParamsCache.get('key');

  return (
    <SettingsTable
      page={page ?? 1}
      perPage={perPage ?? 10}
      search={search ?? ''}
    />
  );
}
