import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Linkedin, Twitter, Check, X, AlertCircle } from 'lucide-react';

type ScheduledPost = {
  id: string;
  scheduled_time: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  post_id: string;
  social_account_id: string;
  published_at: string | null;
  error_message: string | null;
  post?: {
    content: string;
    platform: 'linkedin' | 'twitter';
  };
  social_account?: {
    platform: 'linkedin' | 'twitter';
    account_name: string;
  };
};

export function Schedule() {
  const { currentWorkspace } = useAuth();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all');

  useEffect(() => {
    if (currentWorkspace) {
      loadScheduledPosts();
    }
  }, [currentWorkspace, filter]);

  const loadScheduledPosts = async () => {
    setLoading(true);
    const mockPosts: ScheduledPost[] = [
      {
        id: '1',
        scheduled_time: new Date(Date.now() + 86400000).toISOString(),
        status: 'scheduled',
        post_id: 'p1',
        social_account_id: 's1',
        published_at: null,
        error_message: null,
        post: {
          content: '🚀 Excited to share some insights from our latest research!\n\nWe\'ve discovered that companies leveraging AI automation see a 40% increase in productivity.',
          platform: 'linkedin',
        },
        social_account: {
          platform: 'linkedin',
          account_name: 'Company LinkedIn',
        },
      },
      {
        id: '2',
        scheduled_time: new Date(Date.now() + 172800000).toISOString(),
        status: 'scheduled',
        post_id: 'p2',
        social_account_id: 's2',
        published_at: null,
        error_message: null,
        post: {
          content: '🔥 AI automation is changing the game. 40% productivity boost for companies that embrace it.\n\nNot replacing humans, just making us better at what we do.',
          platform: 'twitter',
        },
        social_account: {
          platform: 'twitter',
          account_name: '@company',
        },
      },
      {
        id: '3',
        scheduled_time: new Date(Date.now() - 86400000).toISOString(),
        status: 'published',
        post_id: 'p3',
        social_account_id: 's1',
        published_at: new Date(Date.now() - 86400000).toISOString(),
        error_message: null,
        post: {
          content: 'Just analyzed the latest trends in B2B marketing. The results might surprise you 📊',
          platform: 'linkedin',
        },
        social_account: {
          platform: 'linkedin',
          account_name: 'Company LinkedIn',
        },
      },
    ];

    const filtered = filter === 'all' ? mockPosts : mockPosts.filter(p => p.status === filter);
    setScheduledPosts(filtered);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700',
      published: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };

    const icons = {
      scheduled: Clock,
      published: Check,
      failed: X,
      cancelled: AlertCircle,
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        <Icon className="w-4 h-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === -1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  const getPlatformIcon = (platform: 'linkedin' | 'twitter') => {
    return platform === 'linkedin' ? (
      <Linkedin className="w-5 h-5 text-blue-600" />
    ) : (
      <Twitter className="w-5 h-5 text-sky-500" />
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Publishing Schedule</h1>
        <p className="text-gray-600">Manage your content calendar and scheduled posts</p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Posts
        </button>
        <button
          onClick={() => setFilter('scheduled')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'scheduled'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setFilter('published')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'published'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Published
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'failed'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Failed
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading schedule...</p>
        </div>
      ) : scheduledPosts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No scheduled posts</h3>
          <p className="text-gray-600">Start by generating and scheduling some content</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {post.post && getPlatformIcon(post.post.platform)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {post.social_account?.account_name}
                    </p>
                    <p className="text-sm text-gray-500">{formatDate(post.scheduled_time)}</p>
                  </div>
                </div>
                {getStatusBadge(post.status)}
              </div>

              {post.post && (
                <p className="text-gray-700 mb-4 line-clamp-3">{post.post.content}</p>
              )}

              {post.error_message && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{post.error_message}</p>
                </div>
              )}

              {post.status === 'scheduled' && (
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                    Edit Schedule
                  </button>
                  <button className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                    Cancel
                  </button>
                </div>
              )}

              {post.status === 'published' && post.published_at && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Published {formatDate(post.published_at)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
