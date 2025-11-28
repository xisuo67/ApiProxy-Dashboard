'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { IconSettings, IconPlus } from '@tabler/icons-react';
import { AlertModal } from '@/components/modal/alert-modal';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { buildSettingsColumns } from './settings-columns';

export interface SettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface SettingsTableClientProps {
  data: SettingRow[];
  totalItems: number;
  initialPage: number;
  initialPerPage: number;
  initialSearch: string;
}

export function SettingsTableClient({
  data,
  totalItems,
  initialPage,
  initialPerPage,
  initialSearch
}: SettingsTableClientProps) {
  const router = useRouter();

  const [rows, setRows] = useState<SettingRow[]>(data);
  const [total, setTotal] = useState(totalItems);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增配置');
  const [editingRow, setEditingRow] = useState<SettingRow | null>(null);

  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // DataTable & 分页（与 Product 页面风格保持一致）
  const [pageSize] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage || 10)
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize || 1));

  const columns: ColumnDef<SettingRow, unknown>[] = useMemo(
    () =>
      buildSettingsColumns({
        onEdit: (row) => openEditModal(row),
        onDelete: (id) => onDeleteClick(id)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { table } = useDataTable<SettingRow>({
    data: rows,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: Math.max(0, (initialPage || 1) - 1),
        pageSize: initialPerPage || 10
      }
    },
    shallow: false, // 触发带查询参数的网络请求，和 Product 页面一致
    debounceMs: 500
  });

  // 当服务端数据变更（翻页/搜索）时，当前组件会被重新渲染并带入新的 data/total
  useEffect(() => {
    setRows(data);
    setTotal(totalItems);
  }, [data, totalItems]);

  const openCreateModal = () => {
    setEditingRow(null);
    setModalTitle('新增配置');
    setFormKey('');
    setFormValue('');
    setFormDesc('');
    setModalOpen(true);
  };

  const openEditModal = (row: SettingRow) => {
    setEditingRow(row);
    setModalTitle('修改配置');
    setFormKey(row.key);
    setFormValue(row.value);
    setFormDesc(row.description ?? '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formKey.trim() || !formValue.trim()) {
      toast.error('请填写键和值');
      return;
    }
    setSaving(true);
    try {
      const method = editingRow ? 'PUT' : 'POST';
      const url = editingRow
        ? `/api/settings/${editingRow.id}`
        : '/api/settings';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formKey.trim(),
          value: formValue.trim(),
          description: formDesc.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '保存失败');
      }

      toast.success(editingRow ? '修改成功' : '新增成功');
      setModalOpen(false);
      // 重新刷新当前列表（保持查询参数不变）
      router.replace(window.location.pathname + window.location.search);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/${deletingId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '删除失败');
      }
      toast.success('删除成功');
      setDeleteOpen(false);
      setDeletingId(null);
      router.replace(window.location.pathname + window.location.search);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar
          table={table}
          className='px-0 pt-0 pb-2'
          showViewOptions={false}
        >
          <Button size='sm' onClick={openCreateModal}>
            <IconPlus className='mr-1 h-4 w-4' />
            新增配置
          </Button>
        </DataTableToolbar>
      </DataTable>

      {/* 新增/编辑模态框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                键(Key)
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='请输入配置键，例如: site_name'
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                disabled={!!editingRow}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                值(Value)
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='请输入配置值'
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>描述(Description)</label>
              <Input
                placeholder='请输入配置描述，方便理解用途'
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>
          <div className='mt-6 flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认模态框（复用 AlertModal） */}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeletingId(null);
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
