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

// 使用主题主色（primary）作为图表颜色，随主题变更自动更新
const primaryColor = 'var(--primary)';

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

    providers.forEach((provider) => {
      // 使用服务商原始名称作为配置键，颜色统一使用主题主色
      config[provider] = {
        label: provider,
        color: primaryColor
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
          return daySum + (day[provider] || 0);
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
                // 用于 <linearGradient> 的安全 id（仅用于 DOM id，不影响数据 key）
                const safeId =
                  provider.replace(/[^a-zA-Z0-9]/g, '_') || `provider_${index}`;
                // 使用 index 确保 key 唯一性
                const uniqueKey = `${safeId}_${index}`;
                return (
                  <linearGradient
                    key={uniqueKey}
                    id={`fill${safeId}`}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='5%'
                      stopColor={primaryColor}
                      stopOpacity={0.9}
                    />
                    <stop
                      offset='95%'
                      stopColor={primaryColor}
                      stopOpacity={0.15}
                    />
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
              const safeId =
                provider.replace(/[^a-zA-Z0-9]/g, '_') || `provider_${index}`;
              // 使用 index 确保 key 唯一性
              const uniqueKey = `${safeId}_${index}`;
              return (
                <Area
                  key={uniqueKey}
                  dataKey={provider}
                  type='natural'
                  fill={`url(#fill${safeId})`}
                  stroke={primaryColor}
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
