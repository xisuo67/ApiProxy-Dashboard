import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { RequestLogTableClient } from './request-log-table-client';

interface RequestLogTableProps {
  page: number;
  perPage: number;
  startDate: string;
  endDate: string;
}

export async function RequestLogTable({
  page,
  perPage,
  startDate,
  endDate
}: RequestLogTableProps) {
  const { userId } = await auth();

  let isAdmin = false;
  let userClerkId = '';

  if (userId) {
    const me = await prisma.user.findUnique({
      where: { clerkId: userId }
    });
    isAdmin = me?.role === 'Admin';
    userClerkId = userId;
  }

  return (
    <RequestLogTableClient
      initialPage={page}
      initialPerPage={perPage}
      initialStartDate={startDate}
      initialEndDate={endDate}
      isAdmin={isAdmin}
      userClerkId={userClerkId}
    />
  );
}
