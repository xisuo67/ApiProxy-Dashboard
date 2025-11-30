'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { MiniProgramRow } from './mini-program-table-client';

interface ApiPricingOption {
  id: string;
  name: string;
}

interface MiniProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: MiniProgramRow | null;
  isAdmin: boolean;
  onSave: (data: {
    name: string;
    appid: string;
    isApproved?: boolean;
    apiPricingIds?: string[];
  }) => Promise<void>;
  saving: boolean;
}

export function MiniProgramFormDialog({
  open,
  onOpenChange,
  editingRow,
  isAdmin,
  onSave,
  saving
}: MiniProgramFormDialogProps) {
  const [formName, setFormName] = useState('');
  const [formAppid, setFormAppid] = useState('');
  const [formIsApproved, setFormIsApproved] = useState(false);
  const [formApiPricingIds, setFormApiPricingIds] = useState<string[]>([]);
  const [apiPricingOptions, setApiPricingOptions] = useState<
    ApiPricingOption[]
  >([]);
  const [pricingSelectOpen, setPricingSelectOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 加载用户关联的服务商列表
  useEffect(() => {
    if (open) {
      loadApiPricingOptions();
    }
  }, [open]);

  const loadApiPricingOptions = async () => {
    setLoadingOptions(true);
    try {
      const res = await fetch('/api/user-pricing');
      if (!res.ok) {
        throw new Error('获取服务商列表失败');
      }
      const data = await res.json();
      const options: ApiPricingOption[] = (data.items || []).map(
        (item: any) => ({
          id: item.apiPricingId,
          name: item.apiPricing.name
        })
      );
      setApiPricingOptions(options);
    } catch (error) {
      console.error('加载服务商列表失败:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (editingRow) {
      setFormName(editingRow.name);
      setFormAppid(editingRow.appid);
      setFormIsApproved(editingRow.isApproved);
      setFormApiPricingIds(editingRow.apiPricingIds || []);
    } else {
      setFormName('');
      setFormAppid('');
      setFormIsApproved(false);
      setFormApiPricingIds([]);
    }
  }, [editingRow, open]);

  const handleSave = async () => {
    if (!formName.trim() || !formAppid.trim()) {
      return;
    }

    await onSave({
      name: formName.trim(),
      appid: formAppid.trim(),
      ...(isAdmin && { isApproved: formIsApproved }),
      apiPricingIds: formApiPricingIds
    });

    if (!saving) {
      onOpenChange(false);
    }
  };

  const toggleApiPricing = (id: string) => {
    setFormApiPricingIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectedPricings = apiPricingOptions.filter((opt) =>
    formApiPricingIds.includes(opt.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingRow ? '编辑小程序' : '新增小程序'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>
              名称
              <span className='text-destructive ml-1'>*</span>
            </Label>
            <Input
              id='name'
              placeholder='请输入小程序名称'
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='appid'>
              AppID
              <span className='text-destructive ml-1'>*</span>
            </Label>
            <Input
              id='appid'
              placeholder='请输入小程序 AppID'
              value={formAppid}
              onChange={(e) => setFormAppid(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className='space-y-2'>
            <Label>选择服务商</Label>
            <Popover
              open={pricingSelectOpen}
              onOpenChange={setPricingSelectOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  className='w-full justify-between'
                  disabled={saving || loadingOptions}
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
                        const isSelected = formApiPricingIds.includes(
                          option.id
                        );
                        return (
                          <CommandItem
                            key={option.id}
                            onSelect={() => toggleApiPricing(option.id)}
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
                      onClick={() => toggleApiPricing(pricing.id)}
                      className='hover:bg-destructive/20 ml-1 rounded-full p-0.5'
                      disabled={saving}
                    >
                      <IconX className='h-3 w-3' />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <div className='flex items-center justify-between space-x-2'>
              <Label htmlFor='isApproved' className='flex-1'>
                审核状态
              </Label>
              <Switch
                id='isApproved'
                checked={formIsApproved}
                onCheckedChange={setFormIsApproved}
                disabled={saving}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formName.trim() || !formAppid.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
