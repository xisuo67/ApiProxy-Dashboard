import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response('Missing CLERK_WEBHOOK_SECRET', { status: 500 });
  }

  const hdrs = await headers();
  const svixId = hdrs.get('svix-id');
  const svixTimestamp = hdrs.get('svix-timestamp');
  const svixSignature = hdrs.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.text();

  let evt: any;

  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    });
  } catch (error) {
    console.error('❌ Clerk webhook verification failed', error);
    return new Response('Invalid signature', { status: 400 });
  }

  const { type, data } = evt as {
    type: string;
    data: any;
  };

  try {
    if (type === 'user.created' || type === 'user.updated') {
      const email =
        data.email_addresses?.[0]?.email_address ??
        data.primary_email_address?.email_address ??
        null;

      await prisma.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email: email ?? undefined,
          name:
            [data.first_name, data.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            data.username ||
            email ||
            '',
          avatarUrl: data.image_url,
          role: 'User'
        },
        update: {
          email: email ?? undefined,
          name:
            [data.first_name, data.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            data.username ||
            email ||
            '',
          avatarUrl: data.image_url
        }
      });
    } else if (type === 'user.deleted') {
      await prisma.user.deleteMany({
        where: { clerkId: data.id }
      });
    }
  } catch (error) {
    console.error('❌ Failed to handle Clerk webhook', error);
    return new Response('Webhook handler error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}
