import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { analyzeTrends } from '@/lib/trends';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, filePath, secret } = body;

    // Validate secret
    if (secret !== process.env.DAEMON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create a default user for development
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'dev@example.com',
          name: 'Dev User',
        },
      });
    }

    // Analyze trends and schedule
    const { optimalTime } = analyzeTrends(fileName);

    // Create the post
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        title: fileName,
        filePath: filePath,
        status: 'SCHEDULED',
        scheduledFor: optimalTime,
      },
    });

    console.log(`New post created: ${post.id} for file ${fileName}`);

    return NextResponse.json({ 
      message: 'Post created successfully', 
      postId: post.id 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(posts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
