import { PricingTableClient } from './pricing-table-client';
import { listApiPricing } from '@/lib/pricing';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

interface PricingTableProps {
  page: number;
  perPage: number;
  search: string;
}

export async function PricingTable({
  page,
  perPage,
  search
}: PricingTableProps) {
  const { userId } = await auth();

  let isAdmin = false;

  if (userId) {
    const me = await prisma.user.findUnique({
      where: { clerkId: userId }
    });
    isAdmin = me?.role === 'Admin';
  }

  const { items, total } = await listApiPricing({
    page,
    perPage,
    search: search || undefined
  });

  return (
    <PricingTableClient
      data={items}
      totalItems={total}
      initialPage={page}
      initialPerPage={perPage}
      isAdmin={isAdmin}
    />
  );
}
