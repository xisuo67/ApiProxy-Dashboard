import { SettingsTableClient } from './settings-table-client';
import { listSettings } from '@/lib/settings';

interface SettingsTableProps {
  page: number;
  perPage: number;
  search: string;
}

export async function SettingsTable({
  page,
  perPage,
  search
}: SettingsTableProps) {
  const { items, total } = await listSettings({
    page,
    perPage,
    search: search || undefined
  });

  return (
    <SettingsTableClient
      data={items}
      totalItems={total}
      initialPage={page}
      initialPerPage={perPage}
      initialSearch={search}
    />
  );
}
