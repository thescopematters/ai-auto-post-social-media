import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { dashboardApi } from "../lib/apiClient";
import {
  FileText,
  Sparkles,
  Calendar,
  TrendingUp,
  ArrowRight,
  Linkedin,
  Twitter,
} from "lucide-react";
import { SocialConnectionStatus } from "./SocialConnectionStatus";
import { SocialConnectionModal } from "./SocialConnectionModal";

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
  const navigate = useNavigate();
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
  const [isSocialConnected, setIsSocialConnected] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);

  const checkSocialConnection = async () => {
    if (!currentWorkspace) return;

    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3002/api/v1";
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setIsSocialConnected(false);
        setShowSocialModal(true);
        return;
      }

      const response = await fetch(
        `${backendUrl}/workspaces/${currentWorkspace.id}/social-accounts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const linkedInConnected = data.data.some(
            (account: any) =>
              account.platform === "linkedin" && account.is_active
          );
          setIsSocialConnected(linkedInConnected);
          
          if (!linkedInConnected) {
            setShowSocialModal(true);
          } else {
            setShowSocialModal(false);
          }
        } else {
          setIsSocialConnected(false);
          setShowSocialModal(true);
        }
      } else {
        setIsSocialConnected(false);
        setShowSocialModal(true);
      }
    } catch (error) {
      console.error("Error checking social connection:", error);
      setIsSocialConnected(false);
      setShowSocialModal(true);
    }
  };

  const loadDashboardData = async () => {
    if (!currentWorkspace) return;

    try {
      const [statsRes, activityRes] = await Promise.all([
        dashboardApi.getStats(currentWorkspace.id),
        dashboardApi.getRecentActivity(currentWorkspace.id, 5),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats({
          totalDocuments: (statsRes.data as any).totalDocuments || 0,
          totalPosts: (statsRes.data as any).totalPosts || 0,
          scheduledPosts: (statsRes.data as any).scheduledPosts || 0,
          pendingModeration: (statsRes.data as any).pendingModeration || 0,
          publishedThisMonth: (statsRes.data as any).publishedThisMonth || 0,
          avgEngagementRate: (statsRes.data as any).avgEngagementRate || 0,
        });
      }

      if (activityRes.success && activityRes.data) {
        setRecentPosts((activityRes.data as any[]) || []);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace) {
      loadDashboardData();
      checkSocialConnection();
    } else {
      setLoading(false);
    }
  }, [currentWorkspace]);

  // Re-check social connection when user comes back to tab
  useEffect(() => {
    const handleFocus = () => {
      if (currentWorkspace) {
        checkSocialConnection();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <SocialConnectionModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here's an overview of your content performance.
          </p>
        </div>

        <SocialConnectionStatus
          isSocialConnected={isSocialConnected}
          onConnect={() => navigate("/settings?tab=connections")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Quick Actions
              </h2>
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
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
              <Link
                to="/generator"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
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
                    <div
                      className={`p-2 rounded-lg ${
                        post.platform === "linkedin"
                          ? "bg-blue-100"
                          : "bg-sky-100"
                      }`}
                    >
                      {post.platform === "linkedin" ? (
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
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        post.moderation_status === "approved"
                          ? "bg-green-100 text-green-700"
                          : post.moderation_status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {post.moderation_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  link: string;
}) {
  return (
    <Link
      to={link}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg text-white`}>{icon}</div>
        <TrendingUp className="w-5 h-5 text-green-500" />
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </Link>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  to,
}: {
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