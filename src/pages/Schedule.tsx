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
  Globe,
  Eye,
  Edit2,
  X as XIcon,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

type ScheduledPost = {
  id: string;
  content: string;
  scheduled_time?: string;
  status: "scheduled" | "published" | "failed" | "cancelled" | "draft";
  published_at?: string;
  error_message?: string;
  external_post_id?: string;
  platform?: string;
  variant_number?: number;
  social_account?: string;
  timezone?: string;
  generated_at?: string; // For drafts
};

type TabType = "scheduled" | "published" | "failed" | "draft";

export function Schedule() {
  const { currentWorkspace } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("scheduled");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>("");

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    title: string;
    post: ScheduledPost;
  } | null>(null);

  useEffect(() => {
    // Detect user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(timezone);
    console.log("🌍 User timezone detected:", timezone);
  }, []);

  // Helper functions for formatting
  const markdownToHtml = (markdown: string) => {
    if (!markdown) return "";
    let clean = markdown
      .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
      .replace(/__([\s\S]*?)__/g, "$1");
    clean = clean
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "$1");
    return clean;
  };

  const textToHtml = (text: string) => {
    if (!text) return "";
    const clean = markdownToHtml(text);
    return clean
      .split(/\n\s*\n/)
      .map(block => {
        const lines = block.trim().split('\n');
        const content = lines.join('<br>');
        return `<p>${content}</p>`;
      })
      .join("");
  };

  const prepareContentForSocial = (html: string) => {
    if (!html) return "";
    const boldMap: { [key: string]: string } = {
      'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
      'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
      '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    const convertToUnicodeBold = (text: string) => text.split('').map(char => boldMap[char] || char).join('');
    const container = document.createElement('div');
    container.innerHTML = html;
    const processNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && (node.parentElement?.tagName === 'STRONG' || node.parentElement?.tagName === 'B')) {
        node.textContent = convertToUnicodeBold(node.textContent || "");
      }
      node.childNodes.forEach(processNodes);
    };
    processNodes(container);
    let content = container.innerHTML;
    content = content.replace(/<\/p><p>/g, '\n\n');
    content = content.replace(/<p>/g, '');
    content = content.replace(/<\/p>/g, '\n');
    content = content.replace(/<br\s*\/?>/gi, '\n');
    const finalTmp = document.createElement('div');
    finalTmp.innerHTML = content;
    return finalTmp.textContent?.trim() || "";
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadScheduledPosts();
    }
  }, [currentWorkspace, activeTab]);

  const loadScheduledPosts = async () => {
    if (!currentWorkspace?.id) return;

    try {
      setLoading(true);

      let data: any[] = [];

      if (activeTab === "draft") {
        const response = await contentApi.getAllPosts(
          currentWorkspace.id,
          1,
          100,
          "draft"
        );
        if (response.success && response.data) {
          // Map generated_posts to ScheduledPost shape
          data = (response.data as any[]).map(p => ({
            ...p,
            status: "draft",
            scheduled_time: p.generated_at // Use generated_at for sorting/display
          }));
        }
      } else {
        const response = await contentApi.getScheduledPosts(currentWorkspace.id);
        if (response.success && response.data) {
          data = response.data as ScheduledPost[];
        }
      }

      setPosts(data || []);

    } catch (error) {
      console.error("❌ Error loading posts:", error);
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

  const handleDeletePost = (post: ScheduledPost) => {
    if (!currentWorkspace) return;

    setDeleteConfirmation({
      id: post.id,
      title: post.status === 'draft' ? 'draft post' : 'scheduled post',
      post: post
    });
  };

  const executeDelete = async (post: ScheduledPost) => {
    if (!currentWorkspace) return;

    setDeleting(post.id);
    try {
      let response;
      if (post.status === "draft") {
        response = await contentApi.deletePost(
          currentWorkspace.id,
          post.id
        );
      } else {
        response = await contentApi.deleteScheduledPost(
          currentWorkspace.id,
          post.id
        );
      }

      if (response.success) {
        setPosts(posts.filter((p) => p.id !== post.id));
        toast.success(`${post.status === 'draft' ? 'Draft' : 'Scheduled post'} deleted successfully!`);
      } else {
        toast.error(`Failed to delete ${post.status === 'draft' ? 'draft' : 'scheduled post'}`, {
          description: response.error,
        });
      }
    } catch (error) {
      console.error(`Error deleting ${post.status}:`, error);
      toast.error(`Error deleting ${post.status}`);
    } finally {
      setDeleting(null);
      setDeleteConfirmation(null);
    }
  };

  const handleEditClick = (post: ScheduledPost) => {
    setSelectedPost(post);
    setEditedContent(textToHtml(post.content));
    setShowEditModal(true);
  };

  const handleViewClick = (post: ScheduledPost) => {
    setSelectedPost(post);
    setEditedContent(textToHtml(post.content));
    setShowViewModal(true);
  };

  const handleSaveEdit = async () => {
    if (!currentWorkspace || !selectedPost || !editedContent.trim()) return;

    setIsSaving(true);
    try {
      const socialContent = prepareContentForSocial(editedContent);
      const response = await contentApi.updateScheduledPost(
        currentWorkspace.id,
        selectedPost.id,
        { content: socialContent }
      );

      if (response.success) {
        setPosts(posts.map(p => p.id === selectedPost.id ? { ...p, content: socialContent } : p));
        toast.success("Post updated successfully!");
        setShowEditModal(false);
      } else {
        toast.error("Failed to update post", { description: response.error });
      }
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Error updating post");
    } finally {
      setIsSaving(false);
    }
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  const quillFormats = [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link'
  ];

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

  // Format date in user's local timezone
  const formatDateTime = (dateString: string, showTimezone: boolean = false) => {
    const date = new Date(dateString);

    const formatted = date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: userTimezone,
    });

    if (showTimezone) {
      const tzAbbr = date.toLocaleTimeString("en-US", {
        timeZone: userTimezone,
        timeZoneName: "short",
      }).split(" ").pop();
      return `${formatted} ${tzAbbr}`;
    }

    return formatted;
  };

  const getTimeRemaining = (scheduledTime: string) => {
    const now = new Date().getTime();
    const scheduled = new Date(scheduledTime).getTime();
    const diff = scheduled - now;

    if (diff <= 0) return "Due now";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `in ${days}d ${hours}h`;
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const getTimezoneDisplay = () => {
    try {
      const now = new Date();
      const tzName = now.toLocaleTimeString("en-US", {
        timeZone: userTimezone,
        timeZoneName: "long",
      }).split(" ").slice(2).join(" ");

      return tzName;
    } catch {
      return userTimezone;
    }
  };

  // Filter posts based on active tab
  const filteredPosts = posts.filter((post) => {
    if (activeTab === "scheduled") {
      return post.status === "scheduled";
    } else if (activeTab === "published") {
      return post.status === "published";
    } else if (activeTab === "failed") {
      return post.status === "failed";
    } else if (activeTab === "draft") {
      return post.status === "draft";
    }
    return false;
  });

  const scheduledCount = posts.filter(post => post.status === "scheduled").length;
  const publishedCount = posts.filter(post => post.status === "published").length;
  const failedCount = posts.filter(post => post.status === "failed").length;

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
        <div className="flex items-center gap-2 text-gray-600">
          <p>Manage your scheduled and published content</p>
          {userTimezone && (
            <div className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              <Globe className="w-3 h-3" />
              <span>{getTimezoneDisplay()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("draft")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === "draft"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <FileText className="w-4 h-4" />
              Drafts
            </button>
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "scheduled"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              Scheduled ({scheduledCount})
            </button>
            <button
              onClick={() => setActiveTab("published")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "published"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              Published ({publishedCount})
            </button>
            <button
              onClick={() => setActiveTab("failed")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "failed"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              Failed ({failedCount})
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
              : activeTab === "published"
                ? "No published posts"
                : "No failed posts"}
          </h3>
          <p className="text-gray-600 mb-4">
            {activeTab === "scheduled"
              ? "Schedule posts from the content generator to see them here"
              : activeTab === "published"
                ? "Published posts will appear here once they're live"
                : activeTab === "draft"
                  ? "Save posts as drafts in the generator to see them here"
                  : "Failed posts will appear here"}
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
              {activeTab === "scheduled"
                ? "Scheduled Posts"
                : activeTab === "published"
                  ? "Published Posts"
                  : "Failed Posts"} ({filteredPosts.length})
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
            {filteredPosts.map((post: ScheduledPost) => (
              <div
                key={post.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div
                      className="text-gray-800 whitespace-pre-wrap mb-2 line-clamp-3 max-w-none"
                      dangerouslySetInnerHTML={{ __html: textToHtml(post.content) }}
                    />

                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
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
                    <button
                      onClick={() => handleViewClick(post)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {post.status === "scheduled" && (
                      <button
                        onClick={() => handleEditClick(post)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {post.status === "draft" && (
                      <button
                        onClick={() => navigate(`/generator?draftId=${post.id}`)}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition text-sm font-medium"
                      >
                        Edit / Schedule
                      </button>
                    )}

                    {(post.status === "scheduled" || post.status === "draft") && (
                      <button
                        onClick={() => handleDeletePost(post)}
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
                        ? `Published: ${post.published_at ? formatDateTime(post.published_at, true) : 'Unknown'}`
                        : post.status === "failed"
                          ? `Failed: ${post.scheduled_time ? formatDateTime(post.scheduled_time, true) : 'Unknown'}`
                          : post.status === "cancelled"
                            ? `Cancelled: ${post.scheduled_time ? formatDateTime(post.scheduled_time, true) : 'Unknown'}`
                            : post.status === "draft"
                              ? `Draft Saved: ${post.scheduled_time ? formatDateTime(post.scheduled_time, true) : 'Unknown'}`
                              : `Scheduled: ${post.scheduled_time ? formatDateTime(post.scheduled_time, true) : 'Unknown'} ${post.scheduled_time ? `(${getTimeRemaining(post.scheduled_time)})` : ''}`}
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

      {/* View Modal */}
      {showViewModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">View Post</h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-none min-h-[400px]">
                <div
                  className="text-gray-800 text-base leading-relaxed linkedin-preview-content"
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>Platform: {selectedPost.platform || "LinkedIn"}</span>
                <span>Scheduled: {selectedPost.scheduled_time ? formatDateTime(selectedPost.scheduled_time, true) : 'N/A'}</span>
                <span>Status: {selectedPost.status}</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden text-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Scheduled Post</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col">
              <div className="flex-1 quill-editor-container">
                <ReactQuill
                  theme="snow"
                  value={editedContent}
                  onChange={setEditedContent}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Edit your post..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isSaving}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editedContent.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 text-xs font-medium"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <DeleteConfirmationModal
          title={deleteConfirmation.title}
          onConfirm={() => executeDelete(deleteConfirmation.post)}
          onCancel={() => setDeleteConfirmation(null)}
        />
      )}
    </div>
  );
}

function DeleteConfirmationModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Delete {title.charAt(0).toUpperCase() + title.slice(1)}?</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this <span className="font-semibold text-gray-900">{title}</span>? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}