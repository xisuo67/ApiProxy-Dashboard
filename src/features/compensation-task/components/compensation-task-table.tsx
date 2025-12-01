import { CompensationTaskTableClient } from './compensation-task-table-client';

interface CompensationTaskTableProps {
  page: number;
  perPage: number;
  status: string;
}

export async function CompensationTaskTable({
  page,
  perPage,
  status
}: CompensationTaskTableProps) {
  return (
    <CompensationTaskTableClient
      initialPage={page}
      initialPerPage={perPage}
      initialStatus={status}
    />
  );
}
