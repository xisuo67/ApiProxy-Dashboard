'use client';

import { useState, useEffect } from 'react';
import { type Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTableBulkActions } from '@/components/data-table/bulk-actions';
import { IconTrash, IconCheck, IconX, IconSettings } from '@tabler/icons-react';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MiniProgramRow } from './mini-program-table-client';

interface ApiPricingOption {
  id: string;
  name: string;
}

interface MiniProgramBulkActionsProps {
  table: Table<MiniProgramRow>;
  isAdmin: boolean;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchApprove: (ids: string[], isApproved: boolean) => Promise<void>;
  onBatchSetPricings: (ids: string[], apiPricingIds: string[]) => Promise<void>;
}

export function MiniProgramBulkActions({
  table,
  isAdmin,
  onBatchDelete,
  onBatchApprove,
  onBatchSetPricings
}: MiniProgramBulkActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [settingPricings, setSettingPricings] = useState(false);
  const [approveStatus, setApproveStatus] = useState<boolean | null>(null);
  const [selectedPricingIds, setSelectedPricingIds] = useState<string[]>([]);
  const [apiPricingOptions, setApiPricingOptions] = useState<
    ApiPricingOption[]
  >([]);
  const [pricingSelectOpen, setPricingSelectOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);

  // 加载用户关联的服务商列表
  useEffect(() => {
    if (pricingDialogOpen) {
      loadApiPricingOptions();
    }
  }, [pricingDialogOpen]);

  const loadApiPricingOptions = async () => {
    setLoadingOptions(true);
    try {
      const res = await fetch('/api/user-pricing');
      if (!res.ok) {
        throw new Error('获取服务商列表失败');
      }
      const data = await res.json();
      // 只显示启用的服务商
      const options: ApiPricingOption[] = (data.items || [])
        .filter((item: any) => item.apiPricing?.isEnabled !== false)
        .map((item: any) => ({
          id: item.apiPricingId,
          name: item.apiPricing.name
        }));
      setApiPricingOptions(options);
    } catch (error) {
      console.error('加载服务商列表失败:', error);
      toast.error('加载服务商列表失败');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await onBatchDelete(selectedIds);
      table.resetRowSelection();
      setDeleteOpen(false);
    } catch (error: any) {
      toast.error(error.message || '批量删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveClick = (isApproved: boolean) => {
    setApproveStatus(isApproved);
    setApproveOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (approveStatus === null) return;
    setApproving(true);
    try {
      await onBatchApprove(selectedIds, approveStatus);
      table.resetRowSelection();
      setApproveOpen(false);
      setApproveStatus(null);
    } catch (error: any) {
      toast.error(error.message || '批量审核失败');
    } finally {
      setApproving(false);
    }
  };

  const handleSetPricingsClick = () => {
    setSelectedPricingIds([]);
    setPricingDialogOpen(true);
  };

  const handleSetPricingsConfirm = async () => {
    setSettingPricings(true);
    try {
      await onBatchSetPricings(selectedIds, selectedPricingIds);
      table.resetRowSelection();
      setPricingDialogOpen(false);
      setSelectedPricingIds([]);
    } catch (error: any) {
      toast.error(error.message || '批量设置服务商失败');
    } finally {
      setSettingPricings(false);
    }
  };

  const togglePricing = (id: string) => {
    setSelectedPricingIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectedPricings = apiPricingOptions.filter((opt) =>
    selectedPricingIds.includes(opt.id)
  );

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <DataTableBulkActions table={table} entityName='小程序'>
        <Button
          variant='default'
          size='sm'
          onClick={handleSetPricingsClick}
          disabled={settingPricings}
        >
          <IconSettings className='mr-1 h-4 w-4' />
          批量设置服务商
        </Button>
        <Button
          variant='destructive'
          size='sm'
          onClick={handleDeleteClick}
          disabled={deleting}
        >
          <IconTrash className='mr-1 h-4 w-4' />
          批量删除
        </Button>
        {isAdmin && (
          <>
            <Button
              variant='default'
              size='sm'
              onClick={() => handleApproveClick(true)}
              disabled={approving}
            >
              <IconCheck className='mr-1 h-4 w-4' />
              批量审核通过
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleApproveClick(false)}
              disabled={approving}
            >
              <IconX className='mr-1 h-4 w-4' />
              批量取消审核
            </Button>
          </>
        )}
      </DataTableBulkActions>

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
          }
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title='确认批量删除？'
        description={`确定要删除选中的 ${selectedIds.length} 个小程序配置吗？删除后将无法恢复。`}
        cancelText='取消'
        confirmText='删除'
      />

      <AlertModal
        isOpen={approveOpen}
        onClose={() => {
          if (!approving) {
            setApproveOpen(false);
            setApproveStatus(null);
          }
        }}
        onConfirm={handleApproveConfirm}
        loading={approving}
        title={`确认批量${approveStatus ? '审核通过' : '取消审核'}？`}
        description={`确定要将选中的 ${selectedIds.length} 个小程序配置${approveStatus ? '审核通过' : '取消审核'}吗？`}
        cancelText='取消'
        confirmText={approveStatus ? '审核通过' : '取消审核'}
      />

      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量设置服务商</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>选择服务商</label>
              <Popover
                open={pricingSelectOpen}
                onOpenChange={setPricingSelectOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    className='w-full justify-between'
                    disabled={settingPricings || loadingOptions}
                  >
                    {selectedPricings.length > 0
                      ? `已选择 ${selectedPricings.length} 个服务商`
                      : '请选择服务商'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-full p-0' align='start'>
                  <Command>
                    <CommandInput placeholder='搜索服务商...' />
                    <CommandList>
                      <CommandEmpty>未找到服务商</CommandEmpty>
                      <CommandGroup>
                        {apiPricingOptions.map((option) => {
                          const isSelected = selectedPricingIds.includes(
                            option.id
                          );
                          return (
                            <CommandItem
                              key={option.id}
                              onSelect={() => togglePricing(option.id)}
                            >
                              <div
                                className={cn(
                                  'border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'opacity-50 [&_svg]:invisible'
                                )}
                              >
                                <IconCheck className='h-4 w-4' />
                              </div>
                              {option.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedPricings.length > 0 && (
                <div className='mt-2 flex flex-wrap gap-1'>
                  {selectedPricings.map((pricing) => (
                    <Badge
                      key={pricing.id}
                      variant='secondary'
                      className='text-xs'
                    >
                      {pricing.name}
                      <button
                        type='button'
                        onClick={() => togglePricing(pricing.id)}
                        className='hover:bg-destructive/20 ml-1 rounded-full p-0.5'
                        disabled={settingPricings}
                      >
                        <IconX className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <p className='text-muted-foreground text-sm'>
              将为选中的 {selectedIds.length} 个小程序配置设置服务商
            </p>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                if (!settingPricings) {
                  setPricingDialogOpen(false);
                  setSelectedPricingIds([]);
                }
              }}
              disabled={settingPricings}
            >
              取消
            </Button>
            <Button
              onClick={handleSetPricingsConfirm}
              disabled={settingPricings || selectedPricingIds.length === 0}
            >
              {settingPricings ? '设置中...' : '确认设置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
