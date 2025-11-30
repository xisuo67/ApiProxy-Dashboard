'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { IconPlus, IconEye, IconEyeOff } from '@tabler/icons-react';
import { AlertModal } from '@/components/modal/alert-modal';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { buildPricingColumns, PricingRow } from './pricing-columns';

interface PricingTableClientProps {
  data: PricingRow[];
  totalItems: number;
  initialPage: number;
  initialPerPage: number;
  isAdmin: boolean;
}

export function PricingTableClient({
  data,
  totalItems,
  initialPage,
  initialPerPage,
  isAdmin
}: PricingTableClientProps) {
  const router = useRouter();

  const [rows, setRows] = useState<PricingRow[]>(data);
  const [total, setTotal] = useState(totalItems);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增服务商');
  const [editingRow, setEditingRow] = useState<PricingRow | null>(null);

  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formApi, setFormApi] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formActualHost, setFormActualHost] = useState('');
  const [formActualApi, setFormActualApi] = useState('');
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<PricingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pageSize] = useQueryState(
    'perPage',
    parseAsInteger.withDefault(initialPerPage || 10)
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize || 1));

  const columns: ColumnDef<PricingRow, unknown>[] = useMemo(
    () =>
      buildPricingColumns({
        isAdmin,
        onEdit: (row) => openEditModal(row),
        onDelete: (row) => onDeleteClick(row)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  );

  const { table } = useDataTable<PricingRow>({
    data: rows,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: Math.max(0, (initialPage || 1) - 1),
        pageSize: initialPerPage || 10
      }
    },
    shallow: false,
    debounceMs: 500
  });

  useEffect(() => {
    setRows(data);
    setTotal(totalItems);
  }, [data, totalItems]);

  const openCreateModal = () => {
    if (!isAdmin) {
      toast.error('只有管理员可以新增服务商');
      return;
    }
    setEditingRow(null);
    setModalTitle('新增服务商');
    setFormName('');
    setFormHost('');
    setFormApi('');
    setFormPrice('');
    setFormApiKey('');
    setFormActualHost('');
    setFormActualApi('');
    setFormIsEnabled(true);
    setModalOpen(true);
  };

  const openEditModal = async (row: PricingRow) => {
    if (!isAdmin) {
      toast.error('只有管理员可以编辑服务商');
      return;
    }
    setEditingRow(row);
    setModalTitle('编辑服务商');
    setFormName(row.name);
    setFormHost(row.host);
    setFormApi(row.api);
    setFormPrice(row.price.toString());
    setFormActualHost(row.actualHost || '');
    setFormActualApi(row.actualApi || '');
    setFormIsEnabled(row.isEnabled ?? true);

    // 通过单独的 API 获取完整信息（包括 apiKey），避免列表查询时泄露敏感信息
    try {
      const res = await fetch(`/api/pricing/${row.id}`);
      if (res.ok) {
        const fullData = await res.json();
        setFormApiKey(fullData.apiKey || '');
        setFormIsEnabled(fullData.isEnabled ?? true);
      } else {
        // 如果获取失败，使用空值
        setFormApiKey('');
      }
    } catch (error) {
      console.error('获取定价详情失败:', error);
      setFormApiKey('');
    }

    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('只有管理员可以管理定价');
      return;
    }

    if (
      !formName.trim() ||
      !formHost.trim() ||
      !formApi.trim() ||
      !formPrice.trim()
    ) {
      toast.error('请填写名称、主机地址、接口和价格');
      return;
    }

    const priceNumber = Number(formPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      toast.error('价格格式不正确');
      return;
    }

    setSaving(true);
    try {
      const method = editingRow ? 'PUT' : 'POST';
      const url = editingRow ? `/api/pricing/${editingRow.id}` : '/api/pricing';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          host: formHost.trim(),
          api: formApi.trim(),
          price: priceNumber,
          apiKey: formApiKey.trim() || null,
          actualHost: formActualHost.trim() || null,
          actualApi: formActualApi.trim() || null,
          isEnabled: formIsEnabled
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '保存失败');
      }

      toast.success(editingRow ? '修改成功' : '新增成功');
      setModalOpen(false);
      router.replace(window.location.pathname + window.location.search);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteClick = (row: PricingRow) => {
    if (!isAdmin) {
      toast.error('只有管理员可以删除服务商');
      return;
    }
    setDeletingRow(row);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error('只有管理员可以删除服务商');
      return;
    }
    if (!deletingRow) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pricing/${deletingRow.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '删除失败');
      }

      toast.success('删除成功');
      setDeleteOpen(false);
      setDeletingRow(null);
      router.replace(window.location.pathname + window.location.search);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar
          table={table}
          className='px-0 pt-0 pb-2'
          showViewOptions={false}
        >
          {isAdmin && (
            <Button size='sm' onClick={openCreateModal}>
              <IconPlus className='mr-1 h-4 w-4' />
              新增服务商
            </Button>
          )}
        </DataTableToolbar>
      </DataTable>

      {/* 新增 / 编辑模态框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                名称
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='例如: 微信支付接口'
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                主机地址 (host)
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='例如: api.example.com'
                value={formHost}
                onChange={(e) => setFormHost(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                接口路径 (api)
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='例如: /api/v1/xxx'
                value={formApi}
                onChange={(e) => setFormApi(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                价格 (每次调用)
                <span className='text-destructive ml-1'>*</span>
              </label>
              <Input
                placeholder='例如: 0.0010'
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                disabled={saving}
              />
            </div>
            {isAdmin && (
              <>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    实际主机地址 (actualHost)
                  </label>
                  <Input
                    placeholder='内部真实调用主机，如 internal-api.example.com'
                    value={formActualHost}
                    onChange={(e) => setFormActualHost(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    实际接口地址 (actualApi)
                  </label>
                  <Input
                    placeholder='内部真实接口路径，如 /internal/v1/xxx'
                    value={formActualApi}
                    onChange={(e) => setFormActualApi(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    API 密钥 (apiKey)
                  </label>
                  <div className='relative'>
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder='请输入 API 密钥'
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      disabled={saving}
                      className='pr-10'
                    />
                    <button
                      type='button'
                      onClick={() => setShowApiKey(!showApiKey)}
                      className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 transition-colors'
                      disabled={saving}
                    >
                      {showApiKey ? (
                        <IconEyeOff className='h-4 w-4' />
                      ) : (
                        <IconEye className='h-4 w-4' />
                      )}
                    </button>
                  </div>
                </div>
                <div className='flex items-center justify-between space-x-2'>
                  <Label htmlFor='isEnabled' className='flex-1'>
                    是否启用
                  </Label>
                  <Switch
                    id='isEnabled'
                    checked={formIsEnabled}
                    onCheckedChange={setFormIsEnabled}
                    disabled={saving}
                  />
                </div>
              </>
            )}
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

      {/* 删除确认模态框 */}
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeletingRow(null);
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
