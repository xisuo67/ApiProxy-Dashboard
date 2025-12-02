'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { RechargeOrderItem } from '@/lib/recharge-order';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, CreditCard, Trash2 } from 'lucide-react';

// 操作按钮组件
function OrderActions({
  orderId,
  status,
  checkoutUrl,
  onDelete
}: {
  orderId: string;
  status: string;
  checkoutUrl: string | null;
  onDelete?: (orderId: string) => void;
}) {
  const handleViewDetails = () => {
    // 在新标签页中打开订单详情
    window.open(`/paycallback?orderId=${orderId}`, '_blank');
  };

  const handleContinuePayment = () => {
    // 在新标签页中打开支付页面
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(orderId);
    }
  };

  return (
    <div className='flex items-center gap-2'>
      {status === 'pending' && checkoutUrl && (
        <Button variant='default' size='sm' onClick={handleContinuePayment}>
          <CreditCard className='mr-2 h-4 w-4' />
          继续支付
        </Button>
      )}
      {status === 'pending' && onDelete && (
        <Button
          variant='ghost'
          size='sm'
          onClick={handleDelete}
          className='text-destructive hover:text-destructive'
        >
          <Trash2 className='mr-2 h-4 w-4' />
          删除
        </Button>
      )}
      <Button variant='ghost' size='sm' onClick={handleViewDetails}>
        <Eye className='mr-2 h-4 w-4' />
        查看详情
      </Button>
    </div>
  );
}

interface BuildRechargeOrderColumnsParams {
  isAdmin?: boolean;
  onDelete?: (orderId: string) => void;
}

export function buildRechargeOrderColumns({
  isAdmin,
  onDelete
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
        return (
          <OrderActions
            orderId={row.original.id}
            status={row.original.status}
            checkoutUrl={row.original.checkoutUrl}
            onDelete={onDelete}
          />
        );
      }
    }
  ];

  return baseColumns;
}
