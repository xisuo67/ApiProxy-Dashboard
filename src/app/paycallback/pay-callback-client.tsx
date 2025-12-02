'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Home,
  BarChart3,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface OrderData {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  payMethod: string | null;
  status: string;
  providerOrderId: string | null;
  paidAt: string | null;
  createdAt: string;
}

type OrderStatus = 'success' | 'pending' | 'failed' | 'not_found' | 'loading';

interface PayCallbackClientProps {
  orderId?: string;
}

export function PayCallbackClient({ orderId }: PayCallbackClientProps) {
  const router = useRouter();
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('loading');
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const confettiTriggeredRef = useRef(false);

  // 查询订单详情
  useEffect(() => {
    if (!orderId) {
      setOrderStatus('not_found');
      return;
    }

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/recharge/order/${orderId}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setOrderStatus('not_found');
          } else {
            setOrderStatus('failed');
          }
          return;
        }

        setOrderData(data);

        // 根据订单状态设置显示状态
        if (data.status === 'succeeded') {
          setOrderStatus('success');
          // 触发撒花效果（只触发一次）
          if (!confettiTriggeredRef.current) {
            triggerConfetti();
            confettiTriggeredRef.current = true;
          }
        } else if (data.status === 'failed' || data.status === 'canceled') {
          setOrderStatus('failed');
        } else {
          setOrderStatus('pending');
        }
      } catch (error) {
        console.error('[FETCH_ORDER_ERROR]', error);
        setOrderStatus('not_found');
      }
    };

    fetchOrder();
  }, [orderId]);

  // 撒花效果
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // 复制订单号
  const handleCopyOrderId = () => {
    if (orderData?.id) {
      navigator.clipboard.writeText(orderData.id);
      toast.success('订单号已复制');
    }
  };

  // 格式化金额
  const formatAmount = (amount: string) => {
    return `¥${Number(amount).toFixed(2)}`;
  };

  // 格式化时间
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 获取状态显示信息
  const getStatusInfo = () => {
    switch (orderStatus) {
      case 'success':
        return {
          icon: <CheckCircle2 className='h-20 w-20 text-green-500' />,
          title: '支付成功',
          subtitle: '订单支付成功',
          iconBg: 'bg-green-50'
        };
      case 'pending':
        return {
          icon: <XCircle className='h-20 w-20 text-red-500' />,
          title: '未支付',
          subtitle: '订单未支付',
          iconBg: 'bg-red-50'
        };
      case 'failed':
        return {
          icon: <XCircle className='h-20 w-20 text-red-500' />,
          title: '支付失败',
          subtitle: '订单支付失败',
          iconBg: 'bg-red-50'
        };
      case 'not_found':
      default:
        return {
          icon: <HelpCircle className='h-20 w-20 text-gray-400' />,
          title: '未支付',
          subtitle: '订单未支付',
          iconBg: 'bg-gray-50'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const isLoading = orderStatus === 'loading';

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 p-4'>
      <Card className='w-full max-w-2xl'>
        <CardContent className='p-8'>
          {/* 状态图标和标题 */}
          <div className='flex flex-col items-center space-y-4 pb-6'>
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full ${statusInfo.iconBg}`}
            >
              {isLoading ? (
                <div className='h-20 w-20 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600' />
              ) : (
                statusInfo.icon
              )}
            </div>
            <div className='text-center'>
              <h1 className='text-3xl font-bold text-gray-900'>
                {statusInfo.title}
              </h1>
              <p className='mt-2 text-gray-500'>{statusInfo.subtitle}</p>
            </div>
          </div>

          <div className='border-t border-gray-200 pt-6'>
            {/* 订单详情 */}
            {isLoading ? (
              <div className='space-y-4'>
                <div className='h-4 animate-pulse rounded bg-gray-200' />
                <div className='h-4 animate-pulse rounded bg-gray-200' />
                <div className='h-4 animate-pulse rounded bg-gray-200' />
              </div>
            ) : orderData ? (
              <div className='space-y-4'>
                <h2 className='text-center text-lg font-semibold text-gray-900'>
                  订单详情
                </h2>
                <div className='space-y-3'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>交易类型:</span>
                    <span className='text-gray-900'>充值</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>业务类型:</span>
                    <span className='text-gray-900'>账户充值</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>支付金额:</span>
                    <span className='font-semibold text-green-600'>
                      {formatAmount(orderData.amount)}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>支付方式:</span>
                    <span className='text-gray-900'>
                      {orderData.payMethod || '-'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>支付时间:</span>
                    <span className='text-gray-900'>
                      {formatTime(orderData.paidAt || orderData.createdAt)}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>交易状态:</span>
                    <span className='text-gray-900'>
                      {orderData.status === 'succeeded'
                        ? '已支付'
                        : orderData.status === 'pending'
                          ? '未支付'
                          : orderData.status === 'failed'
                            ? '支付失败'
                            : orderData.status}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>订单号:</span>
                    <div className='flex items-center gap-2'>
                      <span className='text-gray-900'>{orderData.id}</span>
                      <button
                        onClick={handleCopyOrderId}
                        className='text-gray-400 hover:text-gray-600'
                        title='复制订单号'
                      >
                        <Copy className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className='text-center text-gray-500'>
                {orderStatus === 'not_found'
                  ? '未找到订单信息，请检查订单号是否正确'
                  : '订单信息加载失败'}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='mt-8 space-y-4'>
            <Button
              onClick={() => router.push('/dashboard/billing?tab=history')}
              className='w-full'
              variant='default'
            >
              <BarChart3 className='mr-2 h-4 w-4' />
              查看我的订单
            </Button>
            <Button
              onClick={() => router.push('/dashboard/overview')}
              className='w-full'
              variant='outline'
            >
              <Home className='mr-2 h-4 w-4' />
              返回首页
            </Button>
          </div>

          {/* 提示信息 */}
          <div className='mt-6 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800'>
            <div className='flex items-start gap-2'>
              <span className='text-lg'>ℹ️</span>
              <span>订单已确认，如有问题请联系客服。感谢您的信任与支持！</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
