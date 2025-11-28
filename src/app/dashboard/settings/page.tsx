import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import SettingsViewPage from '@/features/settings/components/settings-view-page';
import { searchParamsCache } from '@/lib/searchparams';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Settings'
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
  // 让下层 RSC 能访问 searchParams（与 Product 页面一致的用法）
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer scrollable={false}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='系统设置'
            description='管理系统配置项，支持分页、搜索与编辑。'
          />
          {/* 右侧暂时留空，如后续需要可以放「导出」等操作按钮 */}
        </div>
        <Separator />
        <Suspense
          fallback={
            <DataTableSkeleton columnCount={4} rowCount={8} filterCount={1} />
          }
        >
          <SettingsViewPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
