import { Video, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function Home() {
  const stats = [
    { label: 'Total Posts', value: '12', icon: Video, color: 'text-blue-500' },
    { label: 'Scheduled', value: '5', icon: Clock, color: 'text-amber-500' },
    { label: 'Uploaded', value: '6', icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Failed', value: '1', icon: AlertCircle, color: 'text-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-zinc-500">Welcome back! Here's what's happening with your content.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`${stat.color}`} size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold">Recent Posts</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-10 text-zinc-500">
            No recent posts found. Start by dropping a video into your watched folder!
          </div>
        </div>
      </div>
    </div>
  );
}
