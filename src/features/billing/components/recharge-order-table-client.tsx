'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { useDataTable } from '@/hooks/use-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { buildRechargeOrderColumns } from './recharge-order-columns';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { RechargeOrderItem } from '@/lib/recharge-order';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { AlertModal } from '@/components/modal/alert-modal';

interface RechargeOrderTableClientProps {
  initialPage: number;
  initialPerPage: number;
  initialStatus?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  isAdmin: boolean;
}

export function RechargeOrderTableClient({
  initialPage,
  initialPerPage,
  initialStatus,
  initialStartDate,
  initialEndDate,
  isAdmin
}: RechargeOrderTableClientProps) {
  const [rows, setRows] = useState<RechargeOrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 获取当月日期范围（如果没有传入初始日期）
  const getDefaultDateRange = useCallback((): DateRange => {
    if (initialStartDate && initialEndDate) {
      return {
        from: new Date(initialStartDate),
        to: new Date(initialEndDate)
      };
    }
    // 默认使用当月
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return {
      from: new Date(year, month, 1),
      to: new Date(year, month + 1, 0, 23, 59, 59, 999)
    };
  }, [initialStartDate, initialEndDate]);

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    return getDefaultDateRange();
  });

  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(initialPage)
  );
  const [perPage] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage)
  );
  const [status, setStatus] = useQueryState(
    'status',
    parseAsString.withDefault(initialStatus || 'all')
  );
  // 计算默认日期（当月）
  const defaultStartDate = useMemo(() => {
    if (initialStartDate) return initialStartDate;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return format(new Date(year, month, 1), 'yyyy-MM-dd');
  }, [initialStartDate]);

  const defaultEndDate = useMemo(() => {
    if (initialEndDate) return initialEndDate;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return format(new Date(year, month + 1, 0, 23, 59, 59, 999), 'yyyy-MM-dd');
  }, [initialEndDate]);

  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsString.withDefault(defaultStartDate)
  );
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsString.withDefault(defaultEndDate)
  );

  const pageCount = Math.max(1, Math.ceil(total / perPage || 1));

  // 删除订单
  const handleDeleteClick = useCallback((orderId: string) => {
    setDeletingOrderId(orderId);
    setDeleteOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!deletingOrderId) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/recharge/order/${deletingOrderId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '删除订单失败');
      }

      toast.success('删除成功');
      setDeleteOpen(false);
      setDeletingOrderId(null);
      // 刷新订单列表
      fetchOrders();
    } catch (error: any) {
      console.error('[DELETE_ORDER_ERROR]', error);
      toast.error(error?.message || '删除订单失败');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<RechargeOrderItem, unknown>[] = useMemo(
    () => buildRechargeOrderColumns({ isAdmin, onDelete: handleDeleteClick }),
    [isAdmin, handleDeleteClick]
  );

  const { table } = useDataTable<RechargeOrderItem>({
    data: rows,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: Math.max(0, (page || 1) - 1),
        pageSize: perPage || 10
      }
    },
    shallow: false,
    debounceMs: 500
  });

  // 获取订单列表
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page || 1),
        perPage: String(perPage || 10)
      });

      if (status && status !== 'all') {
        params.append('status', status);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/recharge/orders?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取订单列表失败');
      }

      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('[FETCH_ORDERS_ERROR]', error);
      toast.error(error?.message || '获取订单列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, status, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 日期范围变化时更新 URL 参数
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      setStartDate(format(dateRange.from, 'yyyy-MM-dd'));
      setEndDate(format(dateRange.to, 'yyyy-MM-dd'));
    }
  }, [dateRange, setStartDate, setEndDate]);

  return (
    <div className='space-y-4'>
      <DataTableToolbar table={table} showViewOptions={false}>
        <div className='flex items-center gap-2'>
          {/* 状态筛选 */}
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1); // 重置到第一页
            }}
          >
            <SelectTrigger className='h-9 w-[180px]'>
              <SelectValue placeholder='选择状态' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部状态</SelectItem>
              <SelectItem value='pending'>待支付</SelectItem>
              <SelectItem value='processing'>处理中</SelectItem>
              <SelectItem value='succeeded'>支付成功</SelectItem>
              <SelectItem value='failed'>支付失败</SelectItem>
              <SelectItem value='canceled'>已取消</SelectItem>
            </SelectContent>
          </Select>

          {/* 日期范围选择 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                className={cn(
                  'h-9 w-[280px] justify-start text-left font-normal',
                  !dateRange && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'yyyy-MM-dd', { locale: zhCN })} -{' '}
                      {format(dateRange.to, 'yyyy-MM-dd', { locale: zhCN })}
                    </>
                  ) : (
                    format(dateRange.from, 'yyyy-MM-dd', { locale: zhCN })
                  )
                ) : (
                  <span>选择日期范围</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar
                mode='range'
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>
      </DataTableToolbar>

      <DataTable table={table} />

      {/* 删除确认对话框 */}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeletingOrderId(null);
          }
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title='确认删除订单？'
        description='删除后将无法恢复，请确认是否继续操作。'
        cancelText='取消'
        confirmText='删除'
      />
    </div>
  );
}
