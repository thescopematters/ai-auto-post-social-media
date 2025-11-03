import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { contentApi } from "../lib/apiClient";
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type ScheduledPost = {
  id: string;
  content: string;
  scheduled_time: string;
  status: "scheduled" | "published" | "failed" | "cancelled";
  published_at?: string;
  error_message?: string;
  external_post_id?: string;
  platform?: string;
  variant_number?: number;
  social_account?: string;
};

type TabType = "scheduled" | "published";

export function Schedule() {
  const { currentWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("scheduled");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadScheduledPosts();
    }
  }, [currentWorkspace]);

  const loadScheduledPosts = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const response = await contentApi.getScheduledPosts(currentWorkspace.id);

      if (response.success && response.data) {
        setPosts(response.data as ScheduledPost[]);
      } else {
        console.error("❌ Failed to load scheduled posts:", response.error);
        setPosts([]);
      }
    } catch (error) {
      console.error("❌ Error loading scheduled posts:", error);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadScheduledPosts();
  };

  const handleDeletePost = async (postId: string) => {
    if (
      !currentWorkspace ||
      !confirm("Are you sure you want to delete this scheduled post?")
    ) {
      return;
    }

    setDeleting(postId);
    try {
      const response = await contentApi.deleteScheduledPost(
        currentWorkspace.id,
        postId
      );

      if (response.success) {
        setPosts(posts.filter((post) => post.id !== postId));
        toast.success("Scheduled post deleted successfully!");
      } else {
        toast.error("Failed to delete scheduled post", {
          description: response.error,
        });
      }
    } catch (error) {
      console.error("Error deleting scheduled post:", error);
      toast.error("Error deleting scheduled post");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (scheduledTime: string) => {
    const now = new Date().getTime();
    const scheduled = new Date(scheduledTime).getTime();
    const diff = scheduled - now;

    if (diff <= 0) return "Due now";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  // Filter posts based on active tab
  const filteredPosts = posts.filter((post) => {
    if (activeTab === "scheduled") {
      return post.status === "scheduled";
    } else if (activeTab === "published") {
      return post.status === "published";
    }
    return false;
  });

  const scheduledCount = posts.filter(post => post.status === "scheduled").length;
  const publishedCount = posts.filter(post => post.status === "published").length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Publishing Schedule
        </h1>
        <p className="text-gray-600">Manage your scheduled and published content</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "scheduled"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Scheduled ({scheduledCount})
            </button>
            <button
              onClick={() => setActiveTab("published")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "published"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Published ({publishedCount})
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {activeTab === "scheduled" 
              ? "No scheduled posts" 
              : "No published posts"}
          </h3>
          <p className="text-gray-600 mb-4">
            {activeTab === "scheduled"
              ? "Schedule posts from the content generator to see them here"
              : "Published posts will appear here once they're live"}
          </p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {activeTab === "scheduled" ? "Scheduled Posts" : "Published Posts"} ({filteredPosts.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <p className="text-gray-800 whitespace-pre-wrap mb-2 line-clamp-3">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Platform: {post.platform || "LinkedIn"}</span>
                      {post.variant_number && (
                        <span>Variant: {post.variant_number}</span>
                      )}
                      {post.social_account && (
                        <span>Account: {post.social_account}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4 flex-wrap justify-end">
                    {post.status === "scheduled" && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deleting === post.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(post.status)}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          post.status
                        )}`}
                      >
                        {post.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
                      {post.status === "published"
                        ? `Published: ${formatDateTime(post.published_at!)}`
                        : post.status === "failed"
                        ? `Failed: ${formatDateTime(post.scheduled_time)}`
                        : post.status === "cancelled"
                        ? `Cancelled: ${formatDateTime(post.scheduled_time)}`
                        : `Scheduled: ${formatDateTime(
                            post.scheduled_time
                          )} (${getTimeRemaining(post.scheduled_time)})`}
                    </p>
                  </div>

                  {post.external_post_id && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${post.external_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View on LinkedIn →
                    </a>
                  )}
                </div>

                {post.error_message && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {post.error_message}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}