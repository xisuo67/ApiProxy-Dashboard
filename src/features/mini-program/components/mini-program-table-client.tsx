'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { IconPlus, IconDownload } from '@tabler/icons-react';
import { AlertModal } from '@/components/modal/alert-modal';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { useDataTable } from '@/hooks/use-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { buildMiniProgramColumns } from './mini-program-columns';
import { MiniProgramFormDialog } from './mini-program-form-dialog';
import { MiniProgramBulkActions } from './mini-program-bulk-actions';
import { format } from 'date-fns';
import type { MiniProgramItem } from '@/lib/mini-program';

export interface MiniProgramRow {
  id: string;
  userId: string;
  name: string;
  appid: string;
  isApproved: boolean;
  apiPricingIds: string[];
  apiPricings?: Array<{ id: string; name: string; isEnabled: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

interface MiniProgramTableClientProps {
  data: MiniProgramItem[];
  totalItems: number;
  initialPage: number;
  initialPerPage: number;
  initialSearch: string;
  initialIsApproved: string | null;
  isAdmin: boolean;
}

export function MiniProgramTableClient({
  data,
  totalItems,
  initialPage,
  initialPerPage,
  initialSearch,
  initialIsApproved,
  isAdmin
}: MiniProgramTableClientProps) {
  const router = useRouter();

  const [rows, setRows] = useState<MiniProgramRow[]>(
    data.map((item) => ({
      ...item,
      apiPricingIds: item.apiPricingIds || [],
      apiPricings: item.apiPricings || [],
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    }))
  );
  const [total, setTotal] = useState(totalItems);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MiniProgramRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<MiniProgramRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pageSize] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage || 10)
  );
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault(initialSearch || '')
  );
  const [isApprovedFilter, setIsApprovedFilter] = useQueryState(
    'isApproved',
    parseAsString.withDefault(initialIsApproved ?? '')
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize || 1));

  const columns: ColumnDef<MiniProgramRow, unknown>[] = useMemo(
    () =>
      buildMiniProgramColumns({
        isAdmin,
        onEdit: (row) => openEditModal(row),
        onDelete: (row) => onDeleteClick(row)
      }),
    [isAdmin]
  );

  const { table } = useDataTable<MiniProgramRow>({
    data: rows,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: Math.max(0, (initialPage || 1) - 1),
        pageSize: initialPerPage || 10
      }
    },
    shallow: false,
    debounceMs: 500
  });

  // 同步 name 列的过滤值到 search 参数
  useEffect(() => {
    if (!table) return;
    const nameColumn = table.getColumn('name');
    if (!nameColumn) return;

    const nameFilter = nameColumn.getFilterValue() as string | undefined;
    const nameValue = nameFilter || '';
    const currentSearch = search || '';

    // 只有当值不同时才更新，避免循环更新
    if (nameValue !== currentSearch) {
      setSearch(nameValue || null);
    }
  }, [table?.getState().columnFilters, search, setSearch, table]);

  // 同步 isApproved 列的过滤值到 URL 参数
  useEffect(() => {
    if (!table) return;
    const isApprovedColumn = table.getColumn('isApproved');
    if (!isApprovedColumn) return;

    const columnFilter = isApprovedColumn.getFilterValue() as
      | string[]
      | undefined;
    const filterValue =
      Array.isArray(columnFilter) && columnFilter.length > 0
        ? columnFilter[0]
        : null;
    const currentFilter = isApprovedFilter || null;

    if (filterValue !== currentFilter) {
      setIsApprovedFilter(filterValue || null);
    }
  }, [
    table?.getState().columnFilters,
    isApprovedFilter,
    setIsApprovedFilter,
    table
  ]);

  // 从 URL 参数同步到列过滤（初始化时）
  useEffect(() => {
    if (!table) return;
    const nameColumn = table.getColumn('name');
    if (
      nameColumn &&
      search &&
      search !== ((nameColumn.getFilterValue() as string) || '')
    ) {
      nameColumn.setFilterValue(search);
    }

    const isApprovedColumn = table.getColumn('isApproved');
    if (isApprovedColumn && isApprovedFilter) {
      const currentFilter = isApprovedColumn.getFilterValue() as
        | string[]
        | undefined;
      if (
        JSON.stringify(currentFilter) !== JSON.stringify([isApprovedFilter])
      ) {
        isApprovedColumn.setFilterValue([isApprovedFilter]);
      }
    }
  }, [search, isApprovedFilter, table]);

  useEffect(() => {
    setRows(
      data.map((item) => ({
        ...item,
        apiPricingIds: item.apiPricingIds || [],
        apiPricings: item.apiPricings || [],
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }))
    );
    setTotal(totalItems);
  }, [data, totalItems]);

  const openCreateModal = () => {
    setEditingRow(null);
    setModalOpen(true);
  };

  const openEditModal = (row: MiniProgramRow) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const onDeleteClick = (row: MiniProgramRow) => {
    setDeletingRow(row);
    setDeleteOpen(true);
  };

  const handleSave = async (formData: {
    name: string;
    appid: string;
    isApproved?: boolean;
    apiPricingIds?: string[];
  }) => {
    setSaving(true);
    try {
      const url = editingRow
        ? `/api/mini-program/${editingRow.id}`
        : '/api/mini-program';
      const method = editingRow ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '保存失败');
      }

      toast.success(editingRow ? '更新成功' : '创建成功');
      setModalOpen(false);
      setEditingRow(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRow) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/mini-program/${deletingRow.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '删除失败');
      }

      toast.success('删除成功');
      setDeleteOpen(false);
      setDeletingRow(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    const res = await fetch('/api/mini-program/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || '批量删除失败');
    }

    toast.success(`成功删除 ${ids.length} 个小程序配置`);
    router.refresh();
  };

  const handleBatchApprove = async (ids: string[], isApproved: boolean) => {
    const res = await fetch('/api/mini-program/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, isApproved })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || '批量审核失败');
    }

    toast.success(
      `成功${isApproved ? '审核通过' : '取消审核'} ${ids.length} 个小程序配置`
    );
    router.refresh();
  };

  const handleBatchSetPricings = async (
    ids: string[],
    apiPricingIds: string[]
  ) => {
    const res = await fetch('/api/mini-program/batch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, apiPricingIds })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || '批量设置服务商失败');
    }

    toast.success(`成功为 ${ids.length} 个小程序配置设置服务商`);
    router.refresh();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true'
      });
      if (search) {
        params.append('search', search);
      }

      const res = await fetch(`/api/mini-program?${params.toString()}`);
      if (!res.ok) {
        throw new Error('导出失败');
      }
      const data = await res.json();
      const items = data.items || [];

      const headers = [
        'ID',
        '用户ID',
        '名称',
        'AppID',
        '审核状态',
        '创建时间',
        '更新时间'
      ];
      const rows = items.map((item: MiniProgramItem) => [
        item.id,
        item.userId,
        item.name,
        item.appid,
        item.isApproved ? '已审核' : '未审核',
        format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        format(new Date(item.updatedAt), 'yyyy-MM-dd HH:mm:ss')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) =>
          row.map((cell) => `"${String(cell)}"`).join(',')
        )
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `小程序配置_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`导出成功，共 ${items.length} 条记录`);
    } catch (error: any) {
      toast.error(error.message || '导出失败');
    }
  };

  return (
    <>
      <DataTable
        table={table}
        actionBar={
          <MiniProgramBulkActions
            table={table}
            isAdmin={isAdmin}
            onBatchDelete={handleBatchDelete}
            onBatchApprove={handleBatchApprove}
            onBatchSetPricings={handleBatchSetPricings}
          />
        }
        tableContainerClassName='!min-h-0 h-auto'
      >
        <DataTableToolbar
          table={table}
          className='px-0 pt-0 pb-2'
          showViewOptions={false}
        >
          <div className='flex w-full items-center justify-end gap-2'>
            <Button size='sm' onClick={openCreateModal}>
              <IconPlus className='mr-1 h-4 w-4' />
              新增小程序
            </Button>
            <Button size='sm' variant='outline' onClick={handleExport}>
              <IconDownload className='mr-1 h-4 w-4' />
              导出CSV
            </Button>
          </div>
        </DataTableToolbar>
      </DataTable>

      <MiniProgramFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingRow={editingRow}
        isAdmin={isAdmin}
        onSave={handleSave}
        saving={saving}
      />

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeletingRow(null);
          }
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title='确认删除？'
        description='删除后将无法恢复，请确认是否继续操作。'
        cancelText='取消'
        confirmText='删除'
      />
    </>
  );
}
