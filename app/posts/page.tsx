import prisma from '@/lib/prisma';
import { Video, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="text-zinc-400" size={18} />;
      case 'SCHEDULED': return <Calendar className="text-amber-500" size={18} />;
      case 'UPLOADING': return <Clock className="text-blue-500 animate-pulse" size={18} />;
      case 'UPLOADED': return <CheckCircle className="text-emerald-500" size={18} />;
      case 'FAILED': return <AlertCircle className="text-rose-500" size={18} />;
      default: return <Clock size={18} />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Posts</h1>
          <p className="text-zinc-500">Manage and schedule your detected video content.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">File</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Detected At</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Scheduled For</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                  No posts found. Drop a video into your watched folder to get started.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                        <Video size={20} className="text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{post.title}</p>
                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{post.filePath}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(post.status)}
                      <span className="text-sm font-medium">{post.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {new Date(post.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString() : 'Not scheduled'}
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-500 transition">
                      Schedule
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
