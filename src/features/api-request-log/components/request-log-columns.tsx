'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { ApiRequestLogItem } from '@/lib/api-request-log';
import { format } from 'date-fns';

interface BuildRequestLogColumnsParams {
  isAdmin: boolean;
}

export function buildRequestLogColumns({
  isAdmin
}: BuildRequestLogColumnsParams): ColumnDef<ApiRequestLogItem>[] {
  const baseColumns: ColumnDef<ApiRequestLogItem>[] = [
    {
      accessorKey: 'serviceProvider',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='服务商' />
      ),
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.serviceProvider}</span>
      )
    },
    {
      accessorKey: 'requestApi',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='请求接口' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.requestApi}</span>
      )
    },
    {
      accessorKey: 'requestBody',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='请求参数' />
      ),
      cell: ({ row }) => {
        const body = row.original.requestBody;
        const truncated =
          body.length > 50 ? body.substring(0, 50) + '...' : body;
        return (
          <span className='font-mono text-xs' title={body}>
            {truncated}
          </span>
        );
      }
    },
    {
      accessorKey: 'displayResponseBody',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='返回参数' />
      ),
      cell: ({ row }) => {
        // 优先使用 displayResponseBody（过滤后的响应），如果没有则使用原始 responseBody
        const body =
          row.original.displayResponseBody || row.original.responseBody || '';
        const truncated =
          body.length > 50 ? body.substring(0, 50) + '...' : body;
        return (
          <span className='font-mono text-xs' title={body}>
            {truncated}
          </span>
        );
      }
    },
    {
      accessorKey: 'cost',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='费用' />
      ),
      cell: ({ row }) => (
        <span className='font-semibold text-red-600'>
          {row.original.cost.toFixed(4)} 元
        </span>
      )
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='请求时间' />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className='text-sm'>{format(date, 'yyyy-MM-dd HH:mm:ss')}</span>
        );
      }
    }
  ];

  // Admin 用户可以看到用户列
  if (isAdmin) {
    return [
      {
        accessorKey: 'userClerkId',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='用户ID' />
        ),
        cell: ({ row }) => (
          <span className='font-mono text-xs'>{row.original.userClerkId}</span>
        )
      },
      ...baseColumns
    ];
  }

  return baseColumns;
}
