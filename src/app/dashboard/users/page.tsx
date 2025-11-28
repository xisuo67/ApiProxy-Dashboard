import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { UserTable } from '@/features/users/components/user-table';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Users'
};

export default async function UsersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <PageContainer scrollable={false}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='用户管理'
            description='查看并管理系统用户，支持手动从 Clerk 同步。'
          />
        </div>
        <Separator />
        <Suspense
          fallback={
            <DataTableSkeleton columnCount={4} rowCount={8} filterCount={1} />
          }
        >
          <UserTable />
        </Suspense>
      </div>
    </PageContainer>
  );
}
