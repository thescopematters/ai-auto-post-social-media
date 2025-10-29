import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { contentApi, documentApi, socialAccountsApi } from "../lib/apiClient";
import {
  Sparkles,
  Settings,
  Linkedin,
  Twitter,
  RefreshCw,
  Calendar,
  Edit2,
  Eye,
  BookOpen,
  Target,
  Anchor,
  RefreshCcw,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type Document = {
  id: string;
  title: string;
  content_text: string | null;
};

type SocialAccount = {
  id: string;
  account_name: string;
  platform: string;
  is_active: boolean;
};

type GeneratedPost = {
  id: string;
  content: string;
  platform: string;
  variant_number?: number;
  user_id?: string;
  framework?: string;
  workspace_id?: string;
  document_id?: string;
  agent_config_id?: string | null;
};

const FRAMEWORKS = {
  auto: { name: "Auto Select", icon: Sparkles, description: "AI chooses the best framework automatically" },
  hvcta: { name: "HVCTA", icon: Anchor, description: "Hook → Value → Call to Action" },
  pas: { name: "PAS", icon: Target, description: "Problem → Agitate → Solution" },
  sla: { name: "SLA", icon: BookOpen, description: "Story → Lesson → Application" },
  mrs: { name: "MRS", icon: RefreshCcw, description: "Mistake → Realization → Shift" },
  cms: { name: "CMS", icon: Clock, description: "Chronological Micro-Story" },
  htof: { name: "HTOF", icon: Zap, description: "Hot Take / Opinion Framework" },
};

export function Generator() {
  const { currentWorkspace } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter">("linkedin");
  const [tone, setTone] = useState("professional");
  const [framework, setFramework] = useState<keyof typeof FRAMEWORKS>("hvcta");
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
      loadSocialAccounts();
    }
  }, [currentWorkspace]);

  const loadDocuments = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await documentApi.getAll(currentWorkspace.id, 1, 100);

      if (response.success && response.data) {
        const completedDocs = (response.data as any[]).filter(
          (doc) => doc.processing_status === "completed"
        );
        setDocuments(completedDocs);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const loadSocialAccounts = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await socialAccountsApi.getAccounts(currentWorkspace.id);

      if (response.success && response.data) {
        setSocialAccounts(response.data as SocialAccount[]);
        const activeAccounts = (response.data as SocialAccount[]).filter(
          (acc) => acc.is_active && acc.platform === platform
        );
        if (activeAccounts.length > 0) {
          setSelectedAccount(activeAccounts[0].id);
        } else {
          console.warn(`No active ${platform} accounts found for workspace`);
        }
      } else {
        console.warn("Failed to load social accounts:", response.error);
        setSocialAccounts([]);
      }
    } catch (error: any) {
      console.error("Error loading social accounts:", error);

      try {
        const fallbackResponse = await fetch("/auth/accounts", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!fallbackResponse.ok) {
          throw new Error(
            `Fallback request failed with status ${fallbackResponse.status}`
          );
        }

        const fallbackJson = await fallbackResponse.json();

        if (fallbackJson.success && fallbackJson.data) {
          const accounts = (fallbackJson.data as any[]).filter(
            (acc: any) => acc.platform === platform && acc.is_active
          );
          setSocialAccounts(accounts);
          if (accounts.length > 0) {
            setSelectedAccount(accounts[0].id);
          }
        }
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        setSocialAccounts([]);
      }
    }
  };

  const handleGenerate = async () => {
    if (!selectedDocument || !currentWorkspace) return;

    setGenerating(true);
    setGeneratedPosts([]);

    try {
      const response = await contentApi.generate(currentWorkspace.id, {
        documentId: selectedDocument,
        platform,
        tone,
        framework,
        variantCount: 3,
      });

      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        const postsWithFramework = (response.data as GeneratedPost[]).map((post) => ({
          ...post,
          framework: post.framework || framework,
          platform: post.platform || platform,
        }));
        setGeneratedPosts(postsWithFramework);
        toast.success("Posts generated!", {
          description: `Created ${postsWithFramework.length} posts using ${FRAMEWORKS[framework].name} framework`,
        });
      } else {
        console.error("Failed to generate posts:", response.error);
        toast.error("Generation failed", {
          description: response.error || "Unable to generate posts",
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleScheduleClick = (post: GeneratedPost) => {
    setSelectedPost(post);
    setShowScheduleModal(true);
  };

  const handlePreviewClick = (post: GeneratedPost) => {
    setSelectedPost(post);
    setShowPreviewModal(true);
  };

  const handleEditClick = (post: GeneratedPost) => {
    setSelectedPost(post);
    setEditedContent(post.content);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPost || !currentWorkspace || !selectedPost.id) return;

    setIsSaving(true);
    try {
      const response = await contentApi.updatePost(
        currentWorkspace.id,
        selectedPost.id,
        { content: editedContent }
      );

      if (response.success) {
        setGeneratedPosts(
          generatedPosts.map((post) =>
            post.id === selectedPost.id
              ? { ...post, content: editedContent }
              : post
          )
        );
        toast.success("Post updated successfully!");
        setShowEditModal(false);
        setSelectedPost(null);
        setEditedContent("");
      } else {
        toast.error("Failed to update post", {
          description: response.error || "Unknown error",
        });
      }
    } catch (error: any) {
      console.error("Error saving post:", error);
      toast.error("Error saving post", {
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedulePost = async () => {
    if (
      !currentWorkspace ||
      !selectedPost?.id ||
      !selectedAccount ||
      !scheduledTime
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    setScheduling(selectedPost.id);

    try {
      const response = await contentApi.schedulePost(currentWorkspace.id, {
        postId: selectedPost.id,
        socialAccountId: selectedAccount,
        scheduledTime: new Date(scheduledTime).toISOString(),
      });

      if (response.success) {
        toast.success("Post scheduled successfully!");
        setShowScheduleModal(false);
        setSelectedPost(null);
        setScheduledTime("");
      } else {
        toast.error("Failed to schedule post", {
          description: response.error,
        });
      }
    } catch (error: any) {
      console.error("Error scheduling post:", error);
      toast.error("Error scheduling post", {
        description: "Please try again.",
      });
    } finally {
      setScheduling(null);
    }
  };

  const filteredAccounts = socialAccounts.filter(
    (account) => account.platform === platform && account.is_active
  );

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5);
  const minDateTimeString = minDateTime.toISOString().slice(0, 16);

  useEffect(() => {
    if (currentWorkspace) {
      loadSocialAccounts();
    }
  }, [platform, currentWorkspace]);

  const getFrameworkIcon = (frameworkKey: keyof typeof FRAMEWORKS) => {
    const FrameworkIcon = FRAMEWORKS[frameworkKey].icon;
    return <FrameworkIcon className="w-4 h-4" />;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Content Generator
        </h1>
        <p className="text-gray-600">
          Create engaging social media posts from your documents using proven frameworks
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Document
                </label>
                <select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a document</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlatform("linkedin")}
                    className={`p-4 rounded-lg border-2 transition ${
                      platform === "linkedin"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Linkedin
                      className={`w-6 h-6 mx-auto mb-2 ${
                        platform === "linkedin"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    />
                    <span className="block text-sm font-medium">LinkedIn</span>
                  </button>

                  <div
                    className="relative"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <button
                      disabled
                      className={`w-full p-4 rounded-lg border-2 transition cursor-not-allowed opacity-50 border-gray-200`}
                    >
                      <Twitter className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <span className="block text-sm font-medium text-gray-400">
                        Twitter
                      </span>
                    </button>

                    {showTooltip && (
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none">
                        Coming Soon
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Framework
                </label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value as keyof typeof FRAMEWORKS)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(FRAMEWORKS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name} - {config.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="thought_leader">Thought Leader</option>
                  <option value="educational">Educational</option>
                  <option value="promotional">Promotional</option>
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedDocument || generating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Posts
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {generatedPosts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No posts generated yet
              </h3>
              <p className="text-gray-600 mb-6">
                Select a document and click generate to create AI-powered content using {FRAMEWORKS[framework].name} framework
              </p>
              {documents.length === 0 && (
                <p className="text-sm text-yellow-600">
                  You need to upload documents first
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Generated Variants
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    {getFrameworkIcon(framework)}
                    {FRAMEWORKS[framework].name}
                  </span>
                  <span>•</span>
                  <span>{generatedPosts.length} variants</span>
                </div>
              </div>
              {generatedPosts.map((post, index) => (
                <div
                  key={post.id || index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Variant {post.variant_number || index + 1}
                      </span>
                      {post.framework && FRAMEWORKS[post.framework as keyof typeof FRAMEWORKS] && (
                        <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-semibold flex items-center gap-1 border border-purple-200">
                          {getFrameworkIcon(post.framework as keyof typeof FRAMEWORKS)}
                          {FRAMEWORKS[post.framework as keyof typeof FRAMEWORKS].name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewClick(post)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        title="Preview Post"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>

                      <button
                        onClick={() => handleEditClick(post)}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                        title="Edit Post"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => handleScheduleClick(post)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                        title="Schedule Post"
                      >
                        <Calendar className="w-4 h-4" />
                        Schedule
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap mb-4">
                    {post.content}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                      {post.content.length} characters
                    </span>
                    <span className="text-sm text-gray-500 capitalize">
                      {post.platform}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Schedule Post
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Social Account
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an account</option>
                  {filteredAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} ({account.platform})
                    </option>
                  ))}
                </select>
                {filteredAccounts.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    No active {platform} accounts found. Please connect an
                    account first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={minDateTimeString}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Posts must be scheduled at least 5 minutes in advance
                </p>
              </div>

              {selectedPost?.id?.startsWith("mock_") && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a demo post. In a real
                    scenario, this would be scheduled to your social media
                    account.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPost(null);
                  setScheduledTime("");
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedulePost}
                disabled={
                  !selectedAccount || !scheduledTime || scheduling !== null
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Schedule Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal - Read Only */}
      {showPreviewModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Preview Post</h2>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-gray-600">
                  Platform: {selectedPost.platform || "LinkedIn"}
                </p>
                {selectedPost.framework && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    {FRAMEWORKS[selectedPost.framework as keyof typeof FRAMEWORKS]?.name || selectedPost.framework}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
                  {selectedPost.content}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 font-medium">Platform</p>
                  <p className="text-gray-900 capitalize">
                    {selectedPost.platform}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Variant</p>
                  <p className="text-gray-900">{selectedPost.variant_number}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Character Count</p>
                  <p className="text-gray-900">{selectedPost.content.length}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Framework</p>
                  <p className="text-gray-900">
                    {FRAMEWORKS[selectedPost.framework as keyof typeof FRAMEWORKS]?.name || selectedPost.framework || 'Auto'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
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
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Post</h2>
              <p className="text-gray-600 mt-1">
                Make changes to your post content
              </p>
            </div>

            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post Content
                </label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {editedContent.length} characters
                </p>
              </div>

              {selectedPost?.id.startsWith?.("mock_") && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a demo post. Changes will be
                    saved locally only.
                  </p>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Changes will be saved to the database when you click Save.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPost(null);
                  setEditedContent("");
                }}
                disabled={isSaving}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || editedContent === selectedPost.content}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}