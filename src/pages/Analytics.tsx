import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, TrendingUp, Users, Heart, Eye, Share2, MessageCircle, ThumbsUp, Linkedin, Twitter } from 'lucide-react';

type PostMetrics = {
  id: string;
  post_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  impressions_count: number;
  clicks_count: number;
  engagement_rate: number;
  post?: {
    content: string;
    platform: string;
  };
};

export function Analytics() {
  const { currentWorkspace } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PostMetrics[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (currentWorkspace) {
      loadAnalytics();
    }
  }, [currentWorkspace, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);

    const mockMetrics: PostMetrics[] = [
      {
        id: '1',
        post_id: 'p1',
        likes_count: 245,
        comments_count: 32,
        shares_count: 18,
        impressions_count: 5420,
        clicks_count: 342,
        engagement_rate: 5.45,
        post: {
          content: '🚀 Excited to share some insights from our latest research!',
          platform: 'linkedin',
        },
      },
      {
        id: '2',
        post_id: 'p2',
        likes_count: 189,
        comments_count: 24,
        shares_count: 12,
        impressions_count: 3890,
        clicks_count: 256,
        engagement_rate: 5.78,
        post: {
          content: '🔥 AI automation is changing the game.',
          platform: 'twitter',
        },
      },
      {
        id: '3',
        post_id: 'p3',
        likes_count: 312,
        comments_count: 45,
        shares_count: 28,
        impressions_count: 7230,
        clicks_count: 489,
        engagement_rate: 5.32,
        post: {
          content: 'Just analyzed the latest trends in B2B marketing.',
          platform: 'linkedin',
        },
      },
    ];

    setMetrics(mockMetrics);
    setLoading(false);
  };

  const calculateTotals = () => {
    return {
      impressions: metrics.reduce((sum, m) => sum + m.impressions_count, 0),
      engagement: metrics.reduce((sum, m) => sum + m.likes_count + m.comments_count + m.shares_count, 0),
      clicks: metrics.reduce((sum, m) => sum + m.clicks_count, 0),
      avgEngagementRate: metrics.length > 0
        ? (metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length).toFixed(2)
        : '0.00',
    };
  };

  const totals = calculateTotals();

  const getPlatformIcon = (platform: string) => {
    return platform === 'linkedin' ? (
      <Linkedin className="w-4 h-4 text-blue-600" />
    ) : (
      <Twitter className="w-4 h-4 text-sky-500" />
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">Track your content performance across platforms</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeRange === '7d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeRange === '30d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeRange === '90d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{totals.impressions.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Impressions</p>
              <p className="text-xs text-green-600 mt-2">+12.5% from last period</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Heart className="w-6 h-6 text-green-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{totals.engagement.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Engagement</p>
              <p className="text-xs text-green-600 mt-2">+8.3% from last period</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{totals.clicks.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Clicks</p>
              <p className="text-xs text-green-600 mt-2">+15.7% from last period</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-rose-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-rose-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{totals.avgEngagementRate}%</p>
              <p className="text-sm text-gray-600">Avg Engagement Rate</p>
              <p className="text-xs text-green-600 mt-2">+2.1% from last period</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Post Performance</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {metrics.length === 0 ? (
                <div className="p-12 text-center">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No analytics data yet</h3>
                  <p className="text-gray-600">Analytics will appear once your posts are published</p>
                </div>
              ) : (
                metrics.map((metric) => (
                  <div key={metric.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {metric.post && getPlatformIcon(metric.post.platform)}
                          <p className="text-gray-900 font-medium line-clamp-1">
                            {metric.post?.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {metric.impressions_count.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {metric.likes_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {metric.comments_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="w-4 h-4" />
                            {metric.shares_count}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900">{metric.engagement_rate}%</p>
                        <p className="text-sm text-gray-600">Engagement</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(metric.engagement_rate * 10, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Platform</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Linkedin className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">LinkedIn</span>
                  </div>
                  <span className="text-gray-600">65%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 rounded-lg">
                      <Twitter className="w-5 h-5 text-sky-500" />
                    </div>
                    <span className="font-medium text-gray-900">Twitter</span>
                  </div>
                  <span className="text-gray-600">35%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-sky-500 h-2 rounded-full" style={{ width: '35%' }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Best Posting Times</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Weekdays 9-11 AM</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    High Engagement
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Weekdays 2-4 PM</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    Good Engagement
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Weekends 10-12 PM</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                    Medium Engagement
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
