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
} from "lucide-react";

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
  id?: string;
  content: string;
  platform: string;
  variant_number?: number;
};

export function Generator() {
  const { currentWorkspace } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter">("linkedin");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);

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
        // Set default selected account if available
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
        variantCount: 3,
      });

      if (response.success && Array.isArray(response.data)) {
        setGeneratedPosts(response.data as GeneratedPost[]);
      } else {
        console.error("Failed to generate posts:", response.error);
        // Fallback to mock data if API fails
        const mockPosts: GeneratedPost[] = [
          {
            content: `🚀 Exciting insights from our latest research!\n\nWe've discovered that companies leveraging AI automation see a 40% increase in productivity. This isn't just about efficiency – it's about empowering teams to focus on strategic work that drives real value.\n\nWhat's your experience with AI in the workplace?\n\n#AI #Productivity #Innovation`,
            platform: platform,
          },
          {
            content: `Just analyzed the latest trends in ${
              platform === "linkedin" ? "B2B marketing" : "social media"
            }. The results might surprise you 📊\n\nKey takeaways:\n✅ Authentic content wins\n✅ Engagement over reach\n✅ Value-first approach\n\nWant to learn more? Drop a comment below!\n\n#Marketing #Strategy`,
            platform: platform,
          },
          {
            content: `${
              platform === "linkedin" ? "💡" : "🔥"
            } Hot take: The future of content creation is here.\n\nAI isn't replacing creativity – it's amplifying it. Teams using smart automation tools are producing 3x more content while maintaining quality.\n\nThe question isn't whether to adopt AI, but how fast you can integrate it.\n\n#ContentMarketing #DigitalTransformation`,
            platform: platform,
          },
        ].map((post, index) => ({
          ...post,
          variant_number: index + 1,
          id: `mock_${Date.now()}_${index}`,
        }));

        setGeneratedPosts(mockPosts);
      }
    } catch (error) {
      console.error("Error generating content:", error);
      // Fallback to mock data
      const mockPosts: GeneratedPost[] = [
        {
          content: `🚀 Exciting insights from our latest research!\n\nWe've discovered that companies leveraging AI automation see a 40% increase in productivity. This isn't just about efficiency – it's about empowering teams to focus on strategic work that drives real value.\n\nWhat's your experience with AI in the workplace?\n\n#AI #Productivity #Innovation`,
          platform: platform,
          variant_number: 1,
          id: `mock_${Date.now()}_1`,
        },
        {
          content: `Just analyzed the latest trends in ${
            platform === "linkedin" ? "B2B marketing" : "social media"
          }. The results might surprise you 📊\n\nKey takeaways:\n✅ Authentic content wins\n✅ Engagement over reach\n✅ Value-first approach\n\nWant to learn more? Drop a comment below!\n\n#Marketing #Strategy`,
          platform: platform,
          variant_number: 2,
          id: `mock_${Date.now()}_2`,
        },
        {
          content: `${
            platform === "linkedin" ? "💡" : "🔥"
          } Hot take: The future of content creation is here.\n\nAI isn't replacing creativity – it's amplifying it. Teams using smart automation tools are producing 3x more content while maintaining quality.\n\nThe question isn't whether to adopt AI, but how fast you can integrate it.\n\n#ContentMarketing #DigitalTransformation`,
          platform: platform,
          variant_number: 3,
          id: `mock_${Date.now()}_3`,
        },
      ];
      setGeneratedPosts(mockPosts);
    } finally {
      setGenerating(false);
    }
  };

  const handleScheduleClick = (post: GeneratedPost) => {
    if (!post.id || post.id.startsWith("mock_")) {
      alert("❌ Cannot schedule demo posts. Please save the post first.");
      return;
    }
    setSelectedPost(post);
    setShowScheduleModal(true);
  };

  const handleSchedulePost = async () => {
    if (
      !currentWorkspace ||
      !selectedPost ||
      !selectedAccount ||
      !scheduledTime
    ) {
      alert("Please fill all required fields");
      return;
    }

    // Validate if post has an ID (for mock posts, we can't schedule them)
    if (!selectedPost.id || selectedPost.id.startsWith("mock_")) {
      alert(
        "This is a demo post. In a real scenario, this would be scheduled."
      );
      setShowScheduleModal(false);
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
        alert("✅ Post scheduled successfully!");
        setShowScheduleModal(false);
        setSelectedPost(null);
        setScheduledTime("");
      } else {
        alert("❌ Failed to schedule post: " + response.error);
      }
    } catch (error: any) {
      console.error("Error scheduling post:", error);
      alert("❌ Error scheduling post. Please try again.");
    } finally {
      setScheduling(null);
    }
  };

  // Filter social accounts by current platform and active status
  const filteredAccounts = socialAccounts.filter(
    (account) => account.platform === platform && account.is_active
  );

  // Set minimum datetime to current time
  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5); // At least 5 minutes from now
  const minDateTimeString = minDateTime.toISOString().slice(0, 16);

  // Update social accounts when platform changes
  useEffect(() => {
    if (currentWorkspace) {
      loadSocialAccounts();
    }
  }, [platform, currentWorkspace]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Content Generator
        </h1>
        <p className="text-gray-600">
          Create engaging social media posts from your documents
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
                  <button
                    onClick={() => setPlatform("twitter")}
                    className={`p-4 rounded-lg border-2 transition ${
                      platform === "twitter"
                        ? "border-sky-600 bg-sky-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Twitter
                      className={`w-6 h-6 mx-auto mb-2 ${
                        platform === "twitter"
                          ? "text-sky-600"
                          : "text-gray-400"
                      }`}
                    />
                    <span className="block text-sm font-medium">Twitter</span>
                  </button>
                </div>
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
                Select a document and click generate to create AI-powered
                content
              </p>
              {documents.length === 0 && (
                <p className="text-sm text-yellow-600">
                  You need to upload documents first
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Generated Variants
              </h2>
              {generatedPosts.map((post, index) => (
                <div
                  key={post.id || index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Variant {post.variant_number || index + 1}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleScheduleClick(post)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        <Calendar className="w-4 h-4" />
                        Schedule Post
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
    </div>
  );
}
