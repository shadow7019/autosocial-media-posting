'use strict';

import Link from 'next/link';
import { Home, Video, Settings, BarChart2 } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="w-64 bg-zinc-900 text-white flex flex-col h-screen">
      <div className="p-6 text-2xl font-bold border-b border-zinc-800">
        Social Agent
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-800 transition">
          <Home size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/posts" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-800 transition">
          <Video size={20} />
          <span>Posts</span>
        </Link>
        <Link href="/analytics" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-800 transition">
          <BarChart2 size={20} />
          <span>Analytics</span>
        </Link>
        <Link href="/settings" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-800 transition">
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </nav>
      <div className="p-4 border-t border-zinc-800 text-zinc-500 text-xs">
        v1.0.0
      </div>
    </aside>
  );
};

export default Sidebar;
