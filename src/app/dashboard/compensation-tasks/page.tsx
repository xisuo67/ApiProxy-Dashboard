import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import CompensationTaskViewPage from '@/features/compensation-task/components/compensation-task-view-page';
import { searchParamsCache } from '@/lib/searchparams';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Compensation Tasks'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  // 仅管理员可访问
  const me = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true }
  });

  if (!me || me.role !== 'Admin') {
    redirect('/dashboard/overview');
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer scrollable={false}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='补偿任务管理'
            description='仅管理员可见：查看所有补偿任务的执行与状态，用于对账与排查异常。'
          />
        </div>
        <Separator />
        <Suspense
          fallback={
            <DataTableSkeleton columnCount={6} rowCount={8} filterCount={0} />
          }
        >
          <CompensationTaskViewPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
