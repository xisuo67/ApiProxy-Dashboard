'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { buildCompensationTaskColumns } from './compensation-task-columns';
import type { CompensationTaskListItem } from '@/lib/compensation-task-list';

interface CompensationTaskTableClientProps {
  initialPage: number;
  initialPerPage: number;
  initialStatus: string;
}

export function CompensationTaskTableClient({
  initialPage,
  initialPerPage,
  initialStatus
}: CompensationTaskTableClientProps) {
  const [rows, setRows] = useState<CompensationTaskListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page] = useQueryState('page', parseAsInteger.withDefault(initialPage));
  const [perPage] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage)
  );
  const [status, setStatus] = useQueryState(
    'status',
    parseAsString.withDefault(initialStatus || 'all')
  );

  const pageCount = Math.max(1, Math.ceil(total / perPage || 1));

  const columns: ColumnDef<CompensationTaskListItem, unknown>[] = useMemo(
    () => buildCompensationTaskColumns(),
    []
  );

  const { table } = useDataTable<CompensationTaskListItem>({
    data: rows,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: Math.max(0, (page || 1) - 1),
        pageSize: perPage || 10
      }
    },
    shallow: false,
    debounceMs: 500
  });

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page || 1),
          perPage: String(perPage || 10)
        });

        if (status && status !== 'all') {
          params.append('status', status);
        }

        const res = await fetch(`/api/compensation-task?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || '获取补偿任务失败');
        }
        const data = await res.json();
        setRows(data.items || []);
        setTotal(data.total || 0);
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [page, perPage, status]);

  if (loading && rows.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground text-sm'>加载中...</div>
      </div>
    );
  }

  return (
    <div className='flex flex-col space-y-4'>
      {/* 顶部筛选 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm'>
          <span className='text-muted-foreground'>状态筛选：</span>
          <div className='flex flex-wrap gap-2'>
            {[
              { value: 'all', label: '全部' },
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '已失败' }
            ].map((opt) => (
              <Button
                key={opt.value}
                size='sm'
                variant={status === opt.value ? 'default' : 'outline'}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 表格 */}
      <DataTable table={table}>
        <DataTableToolbar
          table={table}
          className='px-0 pt-0 pb-2'
          showViewOptions={false}
        />
      </DataTable>
    </div>
  );
}
