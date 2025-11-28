'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { SettingRow } from './settings-table-client';

interface BuildSettingsColumnsParams {
  onEdit: (row: SettingRow) => void;
  onDelete: (row: SettingRow) => void;
}

export function buildSettingsColumns({
  onEdit,
  onDelete
}: BuildSettingsColumnsParams): ColumnDef<SettingRow>[] {
  return [
    {
      id: 'key',
      accessorKey: 'key',
      header: ({ column }: { column: Column<SettingRow, unknown> }) => (
        <DataTableColumnHeader column={column} title='键(Key)' />
      ),
      cell: ({ cell }) => (
        <div className='font-mono text-xs'>{cell.getValue<string>()}</div>
      ),
      meta: {
        label: '键或描述',
        placeholder: '按键名或描述搜索...',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: '值(Value)',
      cell: ({ cell }) => (
        <div className='max-w-[320px] truncate'>{cell.getValue<string>()}</div>
      )
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: '描述(Description)',
      cell: ({ cell }) => {
        const value = cell.getValue<string | null>();
        return (
          <div className='text-muted-foreground max-w-[360px] truncate'>
            {value || '-'}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className='flex gap-3'>
            <Button
              variant='outline'
              size='sm'
              className='h-8 px-3'
              onClick={() => onEdit(data)}
            >
              <IconEdit className='mr-1 h-4 w-4' />
              编辑
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-8 px-3 text-red-500'
              onClick={() => onDelete(data.id)}
            >
              <IconTrash className='mr-1 h-4 w-4' />
              删除
            </Button>
          </div>
        );
      }
    }
  ];
}
