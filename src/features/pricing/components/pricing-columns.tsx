import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { IconEdit, IconTrash } from '@tabler/icons-react';

export interface PricingRow {
  id: string;
  name: string;
  host: string;
  api: string;
  price: number;
  apiKey: string | null;
  actualHost: string | null;
  actualApi: string | null;
  isEnabled: boolean;
}

interface BuildPricingColumnsParams {
  isAdmin: boolean;
  onEdit: (row: PricingRow) => void;
  onDelete: (row: PricingRow) => void;
}

export function buildPricingColumns({
  isAdmin,
  onEdit,
  onDelete
}: BuildPricingColumnsParams): ColumnDef<PricingRow>[] {
  const baseColumns: ColumnDef<PricingRow>[] = [
    {
      accessorKey: 'name',
      header: '名称',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name}</span>
      ),
      meta: {
        label: '名称',
        placeholder: '按名称搜索...',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      accessorKey: 'host',
      header: '接口地址',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.host}</span>
      ),
      // meta: {
      //   label: '主机或接口',
      //   placeholder: '按主机地址或接口路径搜索...',
      //   variant: 'text'
      // },
      enableColumnFilter: true
    },
    {
      accessorKey: 'api',
      header: '接口',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.api}</span>
      )
    },
    {
      accessorKey: 'price',
      header: '价格（每次调用）',
      cell: ({ row }) => (
        <span className='font-semibold text-emerald-600'>
          {row.original.price.toFixed(4)}
        </span>
      )
    }
  ];

  if (!isAdmin) return baseColumns;

  return [
    ...baseColumns,
    {
      accessorKey: 'actualHost',
      header: '实际主机地址',
      cell: ({ row }) => (
        <span className='text-muted-foreground font-mono text-xs'>
          {row.original.actualHost || '-'}
        </span>
      )
    },
    {
      accessorKey: 'actualApi',
      header: '实际接口地址',
      cell: ({ row }) => (
        <span className='text-muted-foreground font-mono text-xs'>
          {row.original.actualApi || '-'}
        </span>
      )
    },
    {
      accessorKey: 'isEnabled',
      header: '是否启用',
      cell: ({ row }) => {
        const isEnabled = row.original.isEnabled;
        return (
          <Badge variant={isEnabled ? 'default' : 'secondary'}>
            {isEnabled ? '已启用' : '已禁用'}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className='text-center'>操作</div>,
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className='flex items-center justify-center gap-3'>
            <Button
              size='sm'
              variant='ghost'
              className='h-8 px-3'
              onClick={() => onEdit(data)}
            >
              <IconEdit className='mr-1 h-4 w-4' />
              编辑
            </Button>
            <Button
              size='sm'
              variant='ghost'
              className='h-8 px-3 text-red-500'
              onClick={() => onDelete(data)}
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
