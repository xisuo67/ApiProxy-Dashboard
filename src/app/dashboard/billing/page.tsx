import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import PricingViewPage from '@/features/pricing/components/pricing-view-page';
import { ServiceProviderSelector } from '@/features/user-pricing/components/service-provider-selector';
import { searchParamsCache } from '@/lib/searchparams';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata = {
  title: 'Dashboard: Pricing & Billing'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer scrollable={false}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='价格与账单'
            description='管理 API 定价，查看调用价格信息。'
          />
        </div>
        <Separator />
        <Tabs defaultValue='pricing' className='flex flex-1 flex-col'>
          <TabsList className='w-full justify-start'>
            <TabsTrigger value='recharge'>充值</TabsTrigger>
            <TabsTrigger value='pricing'>服务商定价</TabsTrigger>
            <TabsTrigger value='serviceProvider'>选择服务商</TabsTrigger>
            <TabsTrigger value='calculator'>请求日志</TabsTrigger>
            <TabsTrigger value='history'>订单历史</TabsTrigger>
          </TabsList>
          <div className='mt-4 flex-1'>
            <TabsContent value='recharge'>
              <div className='text-muted-foreground text-sm'>
                充值功能暂未实现，后续可在此处集成支付与充值相关流程。
              </div>
            </TabsContent>
            <TabsContent value='pricing'>
              <Suspense
                fallback={
                  <DataTableSkeleton
                    columnCount={4}
                    rowCount={8}
                    filterCount={1}
                  />
                }
              >
                <PricingViewPage />
              </Suspense>
            </TabsContent>
            <TabsContent value='serviceProvider'>
              <ServiceProviderSelector />
            </TabsContent>
            <TabsContent value='calculator'>
              <div className='text-muted-foreground text-sm'>
                请求日志暂未实现
              </div>
            </TabsContent>
            <TabsContent value='history'>
              <div className='text-muted-foreground text-sm'>
                订单 / 账单历史暂未实现，后续可在此展示调用账单记录。
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PageContainer>
  );
}
