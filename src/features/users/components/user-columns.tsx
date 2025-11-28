'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { UserRow } from './user-table-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BuildUserColumnsParams {
  isAdmin: boolean;
  onEdit: (row: UserRow) => void;
  onDelete: (row: UserRow) => void;
}

export function buildUserColumns({
  isAdmin,
  onEdit,
  onDelete
}: BuildUserColumnsParams): ColumnDef<UserRow>[] {
  const baseColumns: ColumnDef<UserRow>[] = [
    {
      id: 'avatar',
      header: '头像',
      cell: ({ row }) => {
        const user = row.original;
        const name = user.name || user.email || '';
        const initials = name
          ? name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
          : 'U';
        return (
          <Avatar>
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={name} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        );
      }
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }: { column: Column<UserRow, unknown> }) => (
        <DataTableColumnHeader column={column} title='姓名' />
      ),
      cell: ({ row }) => {
        const name = row.original.name || '未命名';
        return <span>{name}</span>;
      },
      meta: {
        label: '姓名',
        placeholder: '按姓名或邮箱搜索...',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: '邮箱',
      cell: ({ row }) => row.original.email || '-'
    },
    {
      id: 'role',
      accessorKey: 'role',
      header: '角色',
      cell: ({ row }) => {
        const role = row.original.role;
        const variant = role === 'Admin' ? 'default' : 'outline';
        return (
          <Badge variant={variant} className='capitalize'>
            {role}
          </Badge>
        );
      }
    },
    {
      id: 'isActive',
      accessorKey: 'isActive',
      header: '状态',
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className='text-green-600'>启用</span>
        ) : (
          <span className='text-muted-foreground'>禁用</span>
        )
    }
  ];

  if (!isAdmin) return baseColumns;

  return [
    ...baseColumns,
    {
      id: 'actions',
      header: () => <div className='text-center'>操作</div>,
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className='flex items-center justify-center gap-3'>
            <Button
              size='sm'
              variant='outline'
              className='h-8 px-3'
              onClick={() => onEdit(data)}
            >
              <IconEdit className='mr-1 h-4 w-4' />
              编辑
            </Button>
            <Button
              size='sm'
              variant='outline'
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
