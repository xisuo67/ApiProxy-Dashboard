'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

// 生成颜色数组
const colors = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.6)',
  'hsl(var(--primary) / 0.4)',
  'hsl(var(--primary) / 0.2)'
];

interface AreaGraphProps {
  data?: Array<Record<string, any>>;
  providers?: string[];
}

export function AreaGraph({ data = [], providers = [] }: AreaGraphProps) {
  // 动态生成 chartConfig
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      date: {
        label: '日期'
      }
    };

    providers.forEach((provider, index) => {
      const safeKey = provider.replace(/[^a-zA-Z0-9]/g, '_');
      config[safeKey] = {
        label: provider,
        color: colors[index % colors.length]
      };
    });

    return config;
  }, [providers]);

  // 计算总调用次数
  const totalCalls = useMemo(() => {
    return data.reduce((sum, day) => {
      return (
        sum +
        providers.reduce((daySum, provider) => {
          const safeKey = provider.replace(/[^a-zA-Z0-9]/g, '_');
          return daySum + (day[safeKey] || 0);
        }, 0)
      );
    }, 0);
  }, [data, providers]);

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const [month, day] = dateStr.split('-');
    return `${month}/${day}`;
  };
  if (data.length === 0 || providers.length === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>当月接口调用次数</CardTitle>
          <CardDescription>显示当月接口调用次数</CardDescription>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='text-muted-foreground flex h-[250px] items-center justify-center'>
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>当月接口调用次数</CardTitle>
        <CardDescription>显示当月接口调用次数（按服务商分组）</CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              {providers.map((provider, index) => {
                const safeKey = provider.replace(/[^a-zA-Z0-9]/g, '_');
                const color = colors[index % colors.length];
                return (
                  <linearGradient
                    key={safeKey}
                    id={`fill${safeKey}`}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='5%'
                      stopColor={color}
                      stopOpacity={1.0 - index * 0.15}
                    />
                    <stop offset='95%' stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDate}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            {providers.map((provider, index) => {
              const safeKey = provider.replace(/[^a-zA-Z0-9]/g, '_');
              const color = colors[index % colors.length];
              return (
                <Area
                  key={safeKey}
                  dataKey={safeKey}
                  type='natural'
                  fill={`url(#fill${safeKey})`}
                  stroke={color}
                  stackId='a'
                />
              );
            })}
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              本月总调用次数：{totalCalls.toLocaleString()}{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              {new Date().getFullYear()}年{new Date().getMonth() + 1}月
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
