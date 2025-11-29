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
import type { MiniProgramRow } from './mini-program-table-client';

interface MiniProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: MiniProgramRow | null;
  isAdmin: boolean;
  onSave: (data: {
    name: string;
    appid: string;
    isApproved?: boolean;
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

  useEffect(() => {
    if (editingRow) {
      setFormName(editingRow.name);
      setFormAppid(editingRow.appid);
      setFormIsApproved(editingRow.isApproved);
    } else {
      setFormName('');
      setFormAppid('');
      setFormIsApproved(false);
    }
  }, [editingRow, open]);

  const handleSave = async () => {
    if (!formName.trim() || !formAppid.trim()) {
      return;
    }

    await onSave({
      name: formName.trim(),
      appid: formAppid.trim(),
      ...(isAdmin && { isApproved: formIsApproved })
    });

    if (!saving) {
      onOpenChange(false);
    }
  };

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
