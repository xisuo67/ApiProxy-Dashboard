import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { listMiniProgram } from '@/lib/mini-program';
import { MiniProgramTableClient } from './mini-program-table-client';

interface MiniProgramTableProps {
  page: number;
  perPage: number;
  search: string;
  isApproved: string | null;
}

export async function MiniProgramTable({
  page,
  perPage,
  search,
  isApproved
}: MiniProgramTableProps) {
  const { userId } = await auth();

  let isAdmin = false;
  let userDbId = '';

  if (userId) {
    const me = await prisma.user.findUnique({
      where: { clerkId: userId }
    });
    isAdmin = me?.role === 'Admin';
    userDbId = me?.id.toString() || '';
  }

  const isApprovedBool =
    isApproved === 'true' ? true : isApproved === 'false' ? false : null;

  const data = await listMiniProgram({
    page,
    perPage,
    search: search || null,
    isApproved: isApprovedBool,
    userId: userDbId,
    isAdmin
  });

  return (
    <MiniProgramTableClient
      data={data.items}
      totalItems={data.total}
      initialPage={page}
      initialPerPage={perPage}
      initialSearch={search}
      initialIsApproved={isApproved}
      isAdmin={isAdmin}
    />
  );
}
