'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { buildUserColumns } from './user-columns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertModal } from '@/components/modal/alert-modal';
import { Input } from '@/components/ui/input';

export interface UserRow {
  id: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  role: string;
  isActive: boolean;
  balance: number;
}

interface UserTableClientProps {
  data: UserRow[];
  totalItems: number;
  isAdmin: boolean;
}

export function UserTableClient({
  data,
  totalItems,
  isAdmin
}: UserTableClientProps) {
  const router = useRouter();

  const [rows, setRows] = useState<UserRow[]>(data);
  const [syncing, setSyncing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<string>('User');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editBalance, setEditBalance] = useState<string>('0');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize || 1));

  const columns: ColumnDef<UserRow, unknown>[] = useMemo(
    () =>
      buildUserColumns({
        isAdmin,
        onEdit: (row) => handleOpenEdit(row),
        onDelete: (row) => handleOpenDelete(row)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  );

  const { table } = useDataTable<UserRow>({
    data: rows,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500
  });

  useEffect(() => {
    setRows(data);
  }, [data]);

  const handleOpenEdit = (row: UserRow) => {
    setEditingUser(row);
    setEditRole(row.role || 'User');
    setEditActive(row.isActive);
    setEditBalance(
      typeof row.balance === 'number' ? row.balance.toString() : '0'
    );
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const parsedBalance = parseFloat(editBalance || '0');
    const safeBalance = Number.isNaN(parsedBalance) ? 0 : parsedBalance;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          isActive: editActive,
          balance: safeBalance
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '保存失败');
      }
      toast.success('用户更新成功');
      setEditOpen(false);
      setEditingUser(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDelete = (row: UserRow) => {
    setDeletingId(row.id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '删除失败');
      }
      toast.success('用户删除成功');
      setDeleteOpen(false);
      setDeletingId(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/users/sync', {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '同步失败');
      }
      const result = await res.json();
      toast.success(`同步完成，共同步 ${result.totalSynced ?? 0} 个用户`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '同步失败');
    } finally {
      setSyncing(false);
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
          {isAdmin && (
            <Button
              size='sm'
              variant='outline'
              onClick={handleManualSync}
              disabled={syncing}
            >
              {syncing ? '同步中...' : '手动同步'}
            </Button>
          )}
        </DataTableToolbar>
      </DataTable>

      {/* 编辑角色/状态 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-1'>
              <div className='text-muted-foreground text-sm'>
                {editingUser?.email ?? editingUser?.name ?? ''}
              </div>
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>角色</label>
              <Select
                value={editRole}
                onValueChange={(val) => setEditRole(val)}
              >
                <SelectTrigger size='sm'>
                  <SelectValue placeholder='选择角色' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='User'>User</SelectItem>
                  <SelectItem value='Admin'>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>余额（元）</label>
              <Input
                type='number'
                step='0.01'
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                placeholder='请输入余额'
              />
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>启用状态</span>
              <Switch
                checked={editActive}
                onCheckedChange={(v) => setEditActive(v)}
              />
            </div>
          </div>
          <div className='mt-6 flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
            >
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
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
        title='确认删除用户？'
        description='删除后本地用户数据将无法恢复，不会删除 Clerk 中的账号。'
        cancelText='取消'
        confirmText='删除'
      />
    </>
  );
}
