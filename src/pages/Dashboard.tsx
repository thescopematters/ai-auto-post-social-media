import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Sparkles,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Linkedin,
  Twitter
} from 'lucide-react';

interface DashboardStats {
  totalDocuments: number;
  totalPosts: number;
  scheduledPosts: number;
  pendingModeration: number;
  publishedThisMonth: number;
  avgEngagementRate: number;
}

export function Dashboard() {
  const { currentWorkspace } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    totalPosts: 0,
    scheduledPosts: 0,
    pendingModeration: 0,
    publishedThisMonth: 0,
    avgEngagementRate: 0,
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) {
      loadDashboardData();
    }
  }, [currentWorkspace]);

  const loadDashboardData = async () => {
    if (!currentWorkspace) return;

    const [documentsRes, postsRes, scheduledRes, moderationRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id),
      supabase
        .from('generated_posts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id),
      supabase
        .from('scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'scheduled'),
      supabase
        .from('generated_posts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('moderation_status', 'pending'),
    ]);

    const { data: recentPostsData } = await supabase
      .from('generated_posts')
      .select('*, documents(title)')
      .eq('workspace_id', currentWorkspace.id)
      .order('generated_at', { ascending: false })
      .limit(5);

    setStats({
      totalDocuments: documentsRes.count || 0,
      totalPosts: postsRes.count || 0,
      scheduledPosts: scheduledRes.count || 0,
      pendingModeration: moderationRes.count || 0,
      publishedThisMonth: 0,
      avgEngagementRate: 0,
    });

    setRecentPosts(recentPostsData || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back! Here's an overview of your content performance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Total Documents"
          value={stats.totalDocuments}
          color="bg-blue-500"
          link="/documents"
        />
        <StatCard
          icon={<Sparkles className="w-6 h-6" />}
          label="Generated Posts"
          value={stats.totalPosts}
          color="bg-purple-500"
          link="/generator"
        />
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Scheduled Posts"
          value={stats.scheduledPosts}
          color="bg-green-500"
          link="/schedule"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Pending Review"
          value={stats.pendingModeration}
          color="bg-orange-500"
          link="/moderation"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <QuickActionButton
              icon={<FileText className="w-5 h-5" />}
              label="Upload Document"
              description="Add new content source"
              to="/documents"
            />
            <QuickActionButton
              icon={<Sparkles className="w-5 h-5" />}
              label="Generate Content"
              description="Create new posts with AI"
              to="/generator"
            />
            <QuickActionButton
              icon={<CheckCircle className="w-5 h-5" />}
              label="Review Posts"
              description="Moderate pending content"
              to="/moderation"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Link to="/generator" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </Link>
          </div>
          {recentPosts.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No posts generated yet</p>
              <Link
                to="/generator"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                Generate your first post
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className={`p-2 rounded-lg ${
                    post.platform === 'linkedin' ? 'bg-blue-100' : 'bg-sky-100'
                  }`}>
                    {post.platform === 'linkedin' ? (
                      <Linkedin className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Twitter className="w-4 h-4 text-sky-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {post.content.substring(0, 60)}...
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(post.generated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    post.moderation_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : post.moderation_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {post.moderation_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.pendingModeration > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-1">
              {stats.pendingModeration} {stats.pendingModeration === 1 ? 'post' : 'posts'} awaiting review
            </h3>
            <p className="text-yellow-800 mb-4">
              Review and approve your generated content before scheduling.
            </p>
            <Link
              to="/moderation"
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              Review now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, link }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  link: string;
}) {
  return (
    <Link to={link} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg text-white`}>
          {icon}
        </div>
        <TrendingUp className="w-5 h-5 text-green-500" />
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </Link>
  );
}

function QuickActionButton({ icon, label, description, to }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
    >
      <div className="text-blue-600">{icon}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-gray-400" />
    </Link>
  );
}
