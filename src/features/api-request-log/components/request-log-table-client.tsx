'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { useDataTable } from '@/hooks/use-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { buildRequestLogColumns } from './request-log-columns';
import { toast } from 'sonner';
import { IconDownload } from '@tabler/icons-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { ApiRequestLogItem } from '@/lib/api-request-log';

interface RequestLogTableClientProps {
  initialPage: number;
  initialPerPage: number;
  initialStartDate: string;
  initialEndDate: string;
  isAdmin: boolean;
  userClerkId: string;
}

export function RequestLogTableClient({
  initialPage,
  initialPerPage,
  initialStartDate,
  initialEndDate,
  isAdmin,
  userClerkId
}: RequestLogTableClientProps) {
  const router = useRouter();

  // 默认当天日期范围
  const getTodayRange = (): DateRange => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return { from: today, to: endOfToday };
  };

  const [rows, setRows] = useState<ApiRequestLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (initialStartDate && initialEndDate) {
      return {
        from: new Date(initialStartDate),
        to: new Date(initialEndDate)
      };
    }
    return getTodayRange();
  });
  const [exporting, setExporting] = useState(false);

  const [page] = useQueryState('page', parseAsInteger.withDefault(initialPage));
  const [perPage] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage)
  );
  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsString.withDefault('')
  );
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsString.withDefault('')
  );

  const pageCount = Math.max(1, Math.ceil(total / perPage || 1));

  const columns: ColumnDef<ApiRequestLogItem, unknown>[] = useMemo(
    () => buildRequestLogColumns({ isAdmin }),
    [isAdmin]
  );

  const { table } = useDataTable<ApiRequestLogItem>({
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

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page || 1),
          perPage: String(perPage || 10)
        });

        if (dateRange?.from) {
          params.append(
            'startDate',
            dateRange.from.toISOString().split('T')[0]
          );
        }
        if (dateRange?.to) {
          params.append('endDate', dateRange.to.toISOString().split('T')[0]);
        }

        const res = await fetch(`/api/api-request-log?${params.toString()}`);
        if (!res.ok) {
          throw new Error('获取请求日志失败');
        }
        const data = await res.json();
        setRows(data.items || []);
        setTotal(data.total || 0);
      } catch (error: any) {
        toast.error(error.message || '获取请求日志失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [page, perPage, dateRange]);

  // 初始化时，如果没有URL参数，设置默认当天日期范围
  useEffect(() => {
    if (
      !initialStartDate &&
      !initialEndDate &&
      dateRange?.from &&
      dateRange?.to
    ) {
      setStartDate(dateRange.from.toISOString().split('T')[0]);
      setEndDate(dateRange.to.toISOString().split('T')[0]);
    }
  }, []); // 只在初始化时执行一次

  // 日期范围变化时更新URL参数
  useEffect(() => {
    if (dateRange?.from) {
      setStartDate(dateRange.from.toISOString().split('T')[0]);
    } else {
      setStartDate(null);
    }
    if (dateRange?.to) {
      setEndDate(dateRange.to.toISOString().split('T')[0]);
    } else {
      setEndDate(null);
    }
  }, [dateRange, setStartDate, setEndDate]);

  // 导出CSV
  const handleExport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('请选择时间范围');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        export: 'true',
        startDate: dateRange.from.toISOString().split('T')[0],
        endDate: dateRange.to.toISOString().split('T')[0]
      });

      // 导出时也需要传递权限信息，但这里通过后端自动判断

      const res = await fetch(`/api/api-request-log?${params.toString()}`);
      if (!res.ok) {
        throw new Error('导出失败');
      }
      const data = await res.json();
      const items = data.items || [];

      // 生成CSV内容
      const headers = isAdmin
        ? [
            'ID',
            '用户ID',
            '服务商',
            '请求接口',
            '请求参数',
            '返回参数',
            '费用',
            '请求时间'
          ]
        : [
            'ID',
            '服务商',
            '请求接口',
            '请求参数',
            '返回参数',
            '费用',
            '请求时间'
          ];
      const rows = items.map((item: ApiRequestLogItem) => {
        const baseRow = [
          item.id,
          item.serviceProvider,
          item.requestApi,
          item.requestBody.replace(/"/g, '""'), // 转义CSV中的引号
          item.responseBody.replace(/"/g, '""'),
          item.cost.toFixed(4),
          new Date(item.createdAt).toLocaleString('zh-CN')
        ];
        // Admin 用户在第二列插入用户ID
        return isAdmin
          ? [item.id, item.userClerkId, ...baseRow.slice(1)]
          : baseRow;
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) =>
          row.map((cell) => `"${String(cell)}"`).join(',')
        )
      ].join('\n');

      // 添加BOM以支持中文
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `请求日志_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`导出成功，共 ${items.length} 条记录`);
    } catch (error: any) {
      toast.error(error.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground text-sm'>加载中...</div>
      </div>
    );
  }

  return (
    <div className='flex flex-col space-y-4'>
      {/* 时间筛选和导出按钮 - 放在表格上方 */}
      <div className='flex items-center justify-between'>
        {/* 左侧：时间范围选择器 */}
        <div className='flex items-center gap-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm' className='border-dashed'>
                {dateRange?.from && dateRange?.to ? (
                  <>
                    {format(dateRange.from, 'yyyy-MM-dd', { locale: zhCN })} -{' '}
                    {format(dateRange.to, 'yyyy-MM-dd', { locale: zhCN })}
                  </>
                ) : (
                  '选择时间范围'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar
                initialFocus
                mode='range'
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 右侧：导出CSV按钮 */}
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={handleExport}
            disabled={exporting || !dateRange?.from || !dateRange?.to}
          >
            <IconDownload className='mr-1 h-4 w-4' />
            {exporting ? '导出中...' : '导出对账单'}
          </Button>
        </div>
      </div>

      {/* 数据表格 */}
      <DataTable table={table}>
        <DataTableToolbar
          table={table}
          className='px-0 pt-0 pb-2'
          showViewOptions={false}
        />
      </DataTable>
    </div>
  );
}
