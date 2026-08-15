import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.DAEMON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    
    // Find posts that are scheduled and due for upload
    const duePosts = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: now,
        },
      },
    });

    return NextResponse.json(duePosts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update post status after upload attempt
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { postId, status, platformPostId, secret } = body;

    if (secret !== process.env.DAEMON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        status,
        platformPostId,
        uploadedAt: status === 'UPLOADED' ? new Date() : undefined,
      },
    });

    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
