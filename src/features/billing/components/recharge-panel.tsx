'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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

interface BillingStatistics {
  currentBalance: number;
  monthlyRechargeTotal: number;
  totalRecharge: number;
}

export function RechargePanel() {
  const searchParams = useSearchParams();
  const [payMethod, setPayMethod] = useState<'stripe'>('stripe');
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [statistics, setStatistics] = useState<BillingStatistics>({
    currentBalance: 0,
    monthlyRechargeTotal: 0,
    totalRecharge: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch('/api/billing/statistics');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '获取统计数据失败');
      }

      setStatistics({
        currentBalance: data.currentBalance || 0,
        monthlyRechargeTotal: data.monthlyRechargeTotal || 0,
        totalRecharge: data.totalRecharge || 0
      });
    } catch (error: any) {
      console.error('[FETCH_STATISTICS_ERROR]', error);
      // 静默失败，不显示错误提示
    } finally {
      setLoadingStats(false);
    }
  };

  // 初始加载统计数据
  useEffect(() => {
    fetchStatistics();
  }, []);

  // 处理支付成功/取消回调
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const orderId = searchParams.get('orderId');

    if (success === 'true' && orderId) {
      toast.success('充值成功！余额已更新');
      // 刷新统计数据
      fetchStatistics();
    } else if (canceled === 'true') {
      toast.info('支付已取消');
    }
  }, [searchParams]);

  const handleSelectAmount = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    } else {
      setAmount(0);
    }
  };

  const handleSubmit = async () => {
    // 判断使用预设金额还是自定义金额
    const finalAmount =
      customAmount && customAmount.trim()
        ? Number(customAmount.trim())
        : amount;

    // 验证金额
    if (!finalAmount || finalAmount < 10) {
      toast.error('充值金额最低 10 元');
      return;
    }

    // 验证金额格式（最多两位小数）
    // 将金额转换为字符串，检查小数位数
    const amountStr = finalAmount.toString();
    const decimalIndex = amountStr.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPart = amountStr.substring(decimalIndex + 1);
      if (decimalPart.length > 2) {
        toast.error('充值金额最多支持两位小数');
        return;
      }
    }

    setSubmitting(true);
    try {
      // 调用接口创建订单
      const response = await fetch('/api/recharge/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: finalAmount })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '创建订单失败');
      }

      // 跳转到 Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('未获取到支付链接');
      }
    } catch (error: any) {
      console.error('[RECHARGE_SUBMIT_ERROR]', error);
      toast.error(error?.message || '充值失败，请稍后重试');
      setSubmitting(false);
    }
  };

  return (
    <div className='space-y-6 pb-8'>
      {/* 顶部统计卡片 */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>当前余额</CardTitle>
            <CardDescription>可用余额</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className='h-8 w-24 animate-pulse rounded bg-gray-200' />
            ) : (
              <div className='text-2xl font-semibold'>
                ¥{statistics.currentBalance.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>本月充值总额</CardTitle>
            <CardDescription>当月成功充值金额</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className='h-8 w-24 animate-pulse rounded bg-gray-200' />
            ) : (
              <div className='text-2xl font-semibold'>
                ¥{statistics.monthlyRechargeTotal.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>累计充值</CardTitle>
            <CardDescription>所有支付成功的订单总额</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className='h-8 w-24 animate-pulse rounded bg-gray-200' />
            ) : (
              <div className='text-2xl font-semibold'>
                ¥{statistics.totalRecharge.toFixed(2)}
              </div>
            )}
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
