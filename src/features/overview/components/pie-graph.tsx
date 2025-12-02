'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { Label, Pie, PieChart } from 'recharts';

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

interface PieGraphProps {
  data?: Array<{ provider: string; count: number }>;
}

export function PieGraph({ data = [] }: PieGraphProps) {
  // 转换为图表数据格式
  const chartData = React.useMemo(() => {
    return data.map((item) => ({
      provider: item.provider,
      count: item.count,
      fill: primaryColor
    }));
  }, [data]);

  // 动态生成 chartConfig
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      count: {
        label: '调用次数'
      }
    };

    data.forEach((item) => {
      config[item.provider] = {
        label: item.provider,
        // 使用主题主色，保持 Tooltip/Legend 颜色与图表一致
        color: primaryColor
      };
    });

    return config;
  }, [data]);

  const totalCalls = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.count, 0);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>今日接口调用次数</CardTitle>
          <CardDescription>
            <span className='hidden @[540px]/card:block'>
              今日接口调用次数（按服务商分组）
            </span>
            <span className='@[540px]/card:hidden'>调用次数</span>
          </CardDescription>
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
        <CardTitle>今日接口调用次数</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            今日接口调用次数（按服务商分组）
          </span>
          <span className='@[540px]/card:hidden'>调用次数</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[250px]'
        >
          <PieChart>
            <defs>
              {chartData.map((item, index) => {
                const safeKey =
                  item.provider.replace(/[^a-zA-Z0-9]/g, '_') ||
                  `provider_${index}`;
                const uniqueKey = `${safeKey}_${index}`;
                return (
                  <linearGradient
                    key={uniqueKey}
                    id={`fill${safeKey}`}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='0%'
                      stopColor={primaryColor}
                      stopOpacity={0.9}
                    />
                    <stop
                      offset='100%'
                      stopColor={primaryColor}
                      stopOpacity={0.2}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData.map((item) => {
                const safeKey = item.provider.replace(/[^a-zA-Z0-9]/g, '_');
                return {
                  ...item,
                  fill: `url(#fill${safeKey})`
                };
              })}
              dataKey='count'
              nameKey='provider'
              innerRadius={60}
              strokeWidth={2}
              stroke='var(--background)'
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor='middle'
                        dominantBaseline='middle'
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className='fill-foreground text-3xl font-bold'
                        >
                          {totalCalls.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground text-sm'
                        >
                          总调用次数
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        {chartData.length > 0 && (
          <div className='flex items-center gap-2 leading-none font-medium'>
            今日总调用：{totalCalls.toLocaleString()} 次{' '}
            <IconTrendingUp className='h-4 w-4' />
          </div>
        )}
        <div className='text-muted-foreground leading-none'>
          按服务商分组统计
        </div>
      </CardFooter>
    </Card>
  );
}
