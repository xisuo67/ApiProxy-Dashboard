'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { RechargeOrderItem } from '@/lib/recharge-order';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 操作按钮组件
function OrderActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={() => {
        router.push(`/paycallback?orderId=${orderId}`);
      }}
    >
      <Eye className='mr-2 h-4 w-4' />
      查看详情
    </Button>
  );
}

interface BuildRechargeOrderColumnsParams {
  isAdmin?: boolean;
}

export function buildRechargeOrderColumns({
  isAdmin
}: BuildRechargeOrderColumnsParams): ColumnDef<RechargeOrderItem>[] {
  const baseColumns: ColumnDef<RechargeOrderItem>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单号' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.id}</span>
      )
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='充值金额' />
      ),
      cell: ({ row }) => (
        <span className='font-semibold text-red-600'>
          ¥{Number(row.original.amount).toFixed(2)}
        </span>
      )
    },
    {
      accessorKey: 'provider',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='支付渠道' />
      ),
      cell: ({ row }) => (
        <span className='text-sm'>{row.original.provider}</span>
      )
    },
    {
      accessorKey: 'payMethod',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='支付方式' />
      ),
      cell: ({ row }) => (
        <span className='text-sm'>{row.original.payMethod || '-'}</span>
      )
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单状态' />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const statusMap: Record<
          string,
          {
            label: string;
            variant: 'default' | 'secondary' | 'destructive' | 'outline';
          }
        > = {
          pending: { label: '待支付', variant: 'outline' },
          processing: { label: '处理中', variant: 'secondary' },
          succeeded: { label: '支付成功', variant: 'default' },
          failed: { label: '支付失败', variant: 'destructive' },
          canceled: { label: '已取消', variant: 'outline' }
        };
        const statusInfo = statusMap[status] || {
          label: status,
          variant: 'outline' as const
        };
        // 支付成功使用绿色
        if (status === 'succeeded') {
          return (
            <Badge className='bg-green-600 text-white hover:bg-green-700'>
              {statusInfo.label}
            </Badge>
          );
        }
        return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
      }
    },
    {
      accessorKey: 'paidAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='支付时间' />
      ),
      cell: ({ row }) => {
        const paidAt = row.original.paidAt;
        if (!paidAt) {
          return <span className='text-muted-foreground text-sm'>-</span>;
        }
        const date = new Date(paidAt);
        return (
          <span className='text-sm'>{format(date, 'yyyy-MM-dd HH:mm:ss')}</span>
        );
      }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='创建时间' />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className='text-sm'>{format(date, 'yyyy-MM-dd HH:mm:ss')}</span>
        );
      }
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        return <OrderActions orderId={row.original.id} />;
      }
    }
  ];

  return baseColumns;
}
