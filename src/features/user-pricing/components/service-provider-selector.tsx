'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { AlertModal } from '@/components/modal/alert-modal';
import type { UserPricingItem } from '@/lib/user-pricing';

interface ApiPricingOption {
  id: string;
  name: string;
}

export function ServiceProviderSelector() {
  const router = useRouter();

  const [items, setItems] = useState<UserPricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPricingId, setSelectedPricingId] = useState<string>('');
  const [pricingOptions, setPricingOptions] = useState<ApiPricingOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 加载用户已关联的服务商
  const loadUserPricings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-pricing');
      if (!res.ok) {
        throw new Error('获取服务商列表失败');
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error.message || '获取服务商列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有可用的服务商（用于下拉框）- 只加载启用的
  const loadPricingOptions = async () => {
    try {
      const res = await fetch('/api/pricing?perPage=1000');
      if (!res.ok) {
        throw new Error('获取服务商选项失败');
      }
      const data = await res.json();
      // 只显示启用的服务商
      setPricingOptions(
        (data.items || [])
          .filter((item: any) => item.isEnabled !== false)
          .map((item: any) => ({
            id: item.id,
            name: item.name
          }))
      );
    } catch (error: any) {
      toast.error(error.message || '获取服务商选项失败');
    }
  };

  useEffect(() => {
    loadUserPricings();
    loadPricingOptions();
  }, []);

  const handleOpenModal = () => {
    setSelectedPricingId('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPricingId) {
      toast.error('请选择服务商');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/user-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiPricingId: selectedPricingId })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '添加服务商失败');
      }

      toast.success('添加服务商成功');
      setModalOpen(false);
      setSelectedPricingId('');
      loadUserPricings();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '添加服务商失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user-pricing/${deletingId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '删除失败');
      }

      toast.success('删除成功');
      setDeleteOpen(false);
      setDeletingId(null);
      loadUserPricings();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground text-sm'>加载中...</div>
      </div>
    );
  }

  return (
    <>
      <div className='flex flex-col space-y-4'>
        {/* 右上角新增按钮 */}
        <div className='flex justify-end'>
          <Button size='sm' onClick={handleOpenModal}>
            <IconPlus className='mr-1 h-4 w-4' />
            新增服务商
          </Button>
        </div>

        {/* 卡片网格 - 一行四列 */}
        {items.length === 0 ? (
          <div className='text-muted-foreground flex items-center justify-center py-12 text-sm'>
            暂无关联的服务商，请点击上方按钮添加
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {items.map((item) => (
              <Card key={item.id} className='relative'>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <CardTitle className='text-base'>
                      {item.apiPricing.name}
                    </CardTitle>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='text-muted-foreground hover:text-destructive h-8 w-8 p-0'
                      onClick={() => handleDeleteClick(item.id)}
                    >
                      <IconTrash className='h-4 w-4' />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className='space-y-2'>
                  <div className='text-muted-foreground text-sm'>
                    <span className='font-medium'>价格：</span>
                    <span className='text-emerald-600'>
                      {item.apiPricing.price.toFixed(2)} 元/次
                    </span>
                  </div>
                  <div className='text-muted-foreground text-sm'>
                    <span className='font-medium'>地址：</span>
                    <span className='font-mono text-xs'>
                      {item.apiPricing.host}
                      {item.apiPricing.api}
                    </span>
                  </div>
                  <div className='text-muted-foreground text-sm'>
                    <span className='font-medium'>密钥：</span>
                    <span className='font-mono text-xs'>{item.id}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 新增服务商对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增服务商</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='flex items-center gap-4'>
              <label className='text-sm font-medium whitespace-nowrap'>
                选择服务商
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Select
                value={selectedPricingId}
                onValueChange={setSelectedPricingId}
                disabled={saving}
              >
                <SelectTrigger className='w-full min-w-[300px]'>
                  <SelectValue placeholder='请选择服务商' />
                </SelectTrigger>
                <SelectContent>
                  {pricingOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='mt-6 flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeletingId(null);
          }
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title='确认删除？'
        description='删除后将无法恢复，请确认是否继续操作。'
        cancelText='取消'
        confirmText='删除'
      />
    </>
  );
}
