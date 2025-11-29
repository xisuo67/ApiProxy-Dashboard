'use client';

import { useState } from 'react';
import { type Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTableBulkActions } from '@/components/data-table/bulk-actions';
import { IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import type { MiniProgramRow } from './mini-program-table-client';

interface MiniProgramBulkActionsProps {
  table: Table<MiniProgramRow>;
  isAdmin: boolean;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchApprove: (ids: string[], isApproved: boolean) => Promise<void>;
}

export function MiniProgramBulkActions({
  table,
  isAdmin,
  onBatchDelete,
  onBatchApprove
}: MiniProgramBulkActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveStatus, setApproveStatus] = useState<boolean | null>(null);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);

  const handleDeleteClick = () => {
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await onBatchDelete(selectedIds);
      table.resetRowSelection();
      setDeleteOpen(false);
    } catch (error: any) {
      toast.error(error.message || '批量删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveClick = (isApproved: boolean) => {
    setApproveStatus(isApproved);
    setApproveOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (approveStatus === null) return;
    setApproving(true);
    try {
      await onBatchApprove(selectedIds, approveStatus);
      table.resetRowSelection();
      setApproveOpen(false);
      setApproveStatus(null);
    } catch (error: any) {
      toast.error(error.message || '批量审核失败');
    } finally {
      setApproving(false);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <DataTableBulkActions table={table} entityName='小程序'>
        <Button
          variant='destructive'
          size='sm'
          onClick={handleDeleteClick}
          disabled={deleting}
        >
          <IconTrash className='mr-1 h-4 w-4' />
          批量删除
        </Button>
        {isAdmin && (
          <>
            <Button
              variant='default'
              size='sm'
              onClick={() => handleApproveClick(true)}
              disabled={approving}
            >
              <IconCheck className='mr-1 h-4 w-4' />
              批量审核通过
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleApproveClick(false)}
              disabled={approving}
            >
              <IconX className='mr-1 h-4 w-4' />
              批量取消审核
            </Button>
          </>
        )}
      </DataTableBulkActions>

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
          }
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title='确认批量删除？'
        description={`确定要删除选中的 ${selectedIds.length} 个小程序配置吗？删除后将无法恢复。`}
        cancelText='取消'
        confirmText='删除'
      />

      <AlertModal
        isOpen={approveOpen}
        onClose={() => {
          if (!approving) {
            setApproveOpen(false);
            setApproveStatus(null);
          }
        }}
        onConfirm={handleApproveConfirm}
        loading={approving}
        title={`确认批量${approveStatus ? '审核通过' : '取消审核'}？`}
        description={`确定要将选中的 ${selectedIds.length} 个小程序配置${approveStatus ? '审核通过' : '取消审核'}吗？`}
        cancelText='取消'
        confirmText={approveStatus ? '审核通过' : '取消审核'}
      />
    </>
  );
}
