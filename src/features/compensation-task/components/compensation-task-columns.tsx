'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { CompensationTaskListItem } from '@/lib/compensation-task-list';

export type CompensationTaskRow = CompensationTaskListItem;

export function buildCompensationTaskColumns(): ColumnDef<CompensationTaskRow>[] {
  return [
    {
      id: 'id',
      accessorKey: 'id',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='ID' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground font-mono text-xs'>
          {row.original.id}
        </span>
      )
    },
    {
      id: 'userClerkId',
      accessorKey: 'userClerkId',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='用户Clerk ID' />,
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.userClerkId}</span>
      )
    },
    {
      id: 'serviceProvider',
      accessorKey: 'serviceProvider',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='服务商' />,
      cell: ({ row }) => <span>{row.original.serviceProvider}</span>
    },
    {
      id: 'requestApi',
      accessorKey: 'requestApi',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='请求接口' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground font-mono text-xs'>
          {row.original.requestApi}
        </span>
      )
    },
    {
      id: 'cost',
      accessorKey: 'cost',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='费用' />,
      cell: ({ row }) => (
        <span className='font-mono text-xs text-red-600'>
          {row.original.cost.toFixed(4)}
        </span>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='状态' />,
      cell: ({ row }) => {
        const status = row.original.status;
        const colorMap: Record<string, string> = {
          pending: 'text-yellow-600',
          processing: 'text-blue-600',
          completed: 'text-green-600',
          failed: 'text-red-600'
        };
        const textMap: Record<string, string> = {
          pending: '待处理',
          processing: '处理中',
          completed: '已完成',
          failed: '已失败'
        };
        return (
          <span className={colorMap[status] || ''}>
            {textMap[status] || status}
          </span>
        );
      }
    },
    {
      id: 'retry',
      header: '重试次数',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.retryCount}/{row.original.maxRetries}
        </span>
      )
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='创建时间' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground text-xs'>
          {new Date(row.original.createdAt).toLocaleString('zh-CN')}
        </span>
      )
    },
    {
      id: 'completedAt',
      accessorKey: 'completedAt',
      header: ({
        column
      }: {
        column: Column<CompensationTaskRow, unknown>;
      }) => <DataTableColumnHeader column={column} title='完成时间' />,
      cell: ({ row }) =>
        row.original.completedAt ? (
          <span className='text-muted-foreground text-xs'>
            {new Date(row.original.completedAt).toLocaleString('zh-CN')}
          </span>
        ) : (
          <span className='text-muted-foreground text-xs'>-</span>
        )
    }
  ];
}
