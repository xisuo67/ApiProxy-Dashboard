'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { IconBrandStripe } from '@tabler/icons-react';

const PRESET_AMOUNTS = [10, 50, 100];

export function RechargePanel() {
  const [payMethod, setPayMethod] = useState<'stripe'>('stripe');
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSelectAmount = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setAmount(parsed);
    }
  };

  const handleSubmit = async () => {
    if (!amount || amount < 10) {
      toast.error('自定义金额最低 10 元');
      return;
    }
    setSubmitting(true);
    try {
      // 这里只做原型演示，实际接 Stripe 支付时在此发起创建订单/支付意向请求
      toast.success(`暂未接入真实支付，将模拟充值 ¥${amount.toFixed(2)}`);
    } catch (error: any) {
      toast.error(error?.message || '充值失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='space-y-6 pb-8'>
      {/* 顶部统计卡片（原型展示，数据可后续接入） */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>当前余额</CardTitle>
            <CardDescription>可用余额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>¥0.00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>本月充值总额</CardTitle>
            <CardDescription>当月成功充值金额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>¥0.00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>累计消费</CardTitle>
            <CardDescription>所有订单总费用</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>¥0.00</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>充值</CardTitle>
          <CardDescription>
            为您的账户余额充值，仅支持人民币（元）。
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* 支付方式 */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>支付方式</Label>
            <RadioGroup
              value={payMethod}
              onValueChange={(val) => setPayMethod(val as 'stripe')}
              className='flex flex-wrap gap-4'
            >
              <Label
                className='bg-background flex w-full max-w-md cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm'
                htmlFor='stripe'
              >
                <RadioGroupItem id='stripe' value='stripe' />
                <div className='flex h-8 w-8 items-center justify-center rounded-full bg-sky-100'>
                  <IconBrandStripe className='h-5 w-5 text-sky-600' />
                </div>
                <div className='flex flex-col'>
                  <span className='font-medium'>Stripe 支付</span>
                  <span className='text-muted-foreground text-xs'>
                    支持支付宝 / 国际信用卡 / 借记卡
                  </span>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* 金额选项 */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>金额（元）</Label>
            <div className='grid gap-3 md:grid-cols-3'>
              {PRESET_AMOUNTS.map((val) => (
                <Button
                  key={val}
                  type='button'
                  variant={
                    amount === val && !customAmount ? 'default' : 'outline'
                  }
                  className='h-11'
                  onClick={() => handleSelectAmount(val)}
                >
                  ¥ {val.toFixed(2)}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义金额 */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>自定义金额</Label>
            <Input
              type='number'
              min={10}
              step={1}
              placeholder='最低 10 元'
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              className='h-11 max-w-xs'
            />
            <p className='text-muted-foreground text-xs'>
              自定义金额最低 10 元，暂不支持优惠码。
            </p>
          </div>

          {/* 提示与提交按钮 */}
          <div className='text-xm rounded-md bg-amber-50 px-4 py-3 text-amber-800'>
            所有销量均为最终结算，不接受退款或退账，请确认金额后再进行支付。
          </div>

          <div className='pt-2'>
            <Button
              type='button'
              className='h-11 w-full'
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '处理中...' : '充值'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
