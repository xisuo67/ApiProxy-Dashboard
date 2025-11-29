'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { MiniProgramRow } from './mini-program-table-client';

interface BuildMiniProgramColumnsParams {
  isAdmin: boolean;
  onEdit: (row: MiniProgramRow) => void;
  onDelete: (row: MiniProgramRow) => void;
}

export function buildMiniProgramColumns({
  isAdmin,
  onEdit,
  onDelete
}: BuildMiniProgramColumnsParams): ColumnDef<MiniProgramRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }: { column: Column<MiniProgramRow, unknown> }) => (
        <DataTableColumnHeader column={column} title='名称' />
      ),
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name}</span>
      ),
      meta: {
        label: '名称或AppID',
        placeholder: '按名称或AppID搜索...',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'appid',
      accessorKey: 'appid',
      header: ({ column }: { column: Column<MiniProgramRow, unknown> }) => (
        <DataTableColumnHeader column={column} title='AppID' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.appid}</span>
      ),
      enableColumnFilter: false
    },
    {
      id: 'isApproved',
      accessorKey: 'isApproved',
      header: ({ column }: { column: Column<MiniProgramRow, unknown> }) => (
        <DataTableColumnHeader column={column} title='审核状态' />
      ),
      cell: ({ row }) => {
        const isApproved = row.original.isApproved;
        return (
          <Badge variant={isApproved ? 'default' : 'destructive'}>
            {isApproved ? '已审核' : '未审核'}
          </Badge>
        );
      },
      meta: {
        label: '审核状态',
        variant: 'select',
        options: [
          { label: '已审核', value: 'true' },
          { label: '未审核', value: 'false' }
        ]
      },
      enableColumnFilter: true,
      filterFn: (row, id, value) => {
        const rowValue = row.original.isApproved;
        if (Array.isArray(value) && value.length > 0) {
          return value.some((v) => {
            if (v === 'true') return rowValue === true;
            if (v === 'false') return rowValue === false;
            return false;
          });
        }
        return true;
      }
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        return (
          <div className='flex items-center justify-center gap-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onEdit(row.original)}
              className='h-8 w-8 p-0'
            >
              <IconEdit className='h-4 w-4' />
              <span className='sr-only'>编辑</span>
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onDelete(row.original)}
              className='text-destructive hover:text-destructive h-8 w-8 p-0'
            >
              <IconTrash className='h-4 w-4' />
              <span className='sr-only'>删除</span>
            </Button>
          </div>
        );
      }
    }
  ];
}
