import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { RechargeOrderTableClient } from './recharge-order-table-client';

interface RechargeOrderTableProps {
  page: number;
  perPage: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export async function RechargeOrderTable({
  page,
  perPage,
  status,
  startDate,
  endDate
}: RechargeOrderTableProps) {
  const { userId } = await auth();

  let isAdmin = false;

  if (userId) {
    const me = await prisma.user.findUnique({
      where: { clerkId: userId }
    });
    isAdmin = me?.role === 'Admin';
  }

  return (
    <RechargeOrderTableClient
      initialPage={page}
      initialPerPage={perPage}
      initialStatus={status}
      initialStartDate={startDate}
      initialEndDate={endDate}
      isAdmin={isAdmin}
    />
  );
}
