import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Sparkles, Settings, Linkedin, Twitter, RefreshCw, Calendar, Edit3, X, Clock } from 'lucide-react';

type Document = {
  id: string;
  title: string;
  content_text: string | null;
};

type GeneratedPost = {
  id: string;
  content: string;
  variant_number: number;
};

export function Generator() {
  const { currentWorkspace, user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter">("linkedin");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [postToReview, setPostToReview] = useState<GeneratedPost | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
      loadRecentPosts();
    }
  }, [currentWorkspace]);

  const loadRecentPosts = async () => {
    if (!currentWorkspace) return;

    const { data } = await supabase
      .from("generated_posts")
      .select("id, content, variant_number, platform")
      .eq("workspace_id", currentWorkspace.id)
      .order("generated_at", { ascending: false })
      .limit(10);

    if (data) {
      setGeneratedPosts(data as GeneratedPost[]);
    }
  };

  const loadDocuments = async () => {
    if (!currentWorkspace) return;

    const { data } = await supabase
      .from("documents")
      .select("id, title, content_text")
      .eq("workspace_id", currentWorkspace.id)
      .eq("processing_status", "completed")
      .order("uploaded_at", { ascending: false });

    if (data) {
      setDocuments(data);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDocument || !currentWorkspace || !user) return;

    setGenerating(true);
    setGeneratedPosts([]); // Clear previous posts

    try {
      const mockPosts = [
        `🚀 Exciting insights from our latest research!\n\nWe've discovered that companies leveraging AI automation see a 40% increase in productivity. This isn't just about efficiency – it's about empowering teams to focus on strategic work that drives real value.\n\nWhat's your experience with AI in the workplace?\n\n#AI #Productivity #Innovation`,

        `Just analyzed the latest trends in ${
          platform === "linkedin" ? "B2B marketing" : "social media"
        }. The results might surprise you 📊\n\nKey takeaways:\n✅ Authentic content wins\n✅ Engagement over reach\n✅ Value-first approach\n\nWant to learn more? Drop a comment below!\n\n#Marketing #Strategy`,

        `${
          platform === "linkedin" ? "💡" : "🔥"
        } Hot take: The future of content creation is here.\n\nAI isn't replacing creativity – it's amplifying it. Teams using smart automation tools are producing 3x more content while maintaining quality.\n\nThe question isn't whether to adopt AI, but how fast you can integrate it.\n\n#ContentMarketing #DigitalTransformation`,
      ];

      const insertedPosts: GeneratedPost[] = [];

      for (const content of mockPosts) {
        const { data, error } = await supabase
          .from("generated_posts")
          .insert({
            workspace_id: currentWorkspace.id,
            document_id: selectedDocument,
            platform,
            content,
            variant_number: mockPosts.indexOf(content) + 1,
            moderation_status: "pending",
          })
          .select("id, content, variant_number")
          .single();

        if (data && !error) {
          insertedPosts.push(data);
        } else {
          console.error("Error inserting post:", error);
        }
      }

      setGeneratedPosts(insertedPosts);
    } catch (error) {
      console.error("Error generating posts:", error);
      alert("Failed to generate posts. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedulePost = async (postId: string) => {
    if (!currentWorkspace) return;

    setScheduling(postId);

    try {
      // Create a demo social account directly first
      const { data: newAccount, error: createError } = await supabase
        .from("social_accounts")
        .insert({
          workspace_id: currentWorkspace.id,
          platform: platform,
          account_name: `Demo ${platform} Account`,
          account_id: `demo_${platform}_${Date.now()}`, // Required field
          is_active: true,
        })
        .select("id")
        .single();

      let socialAccountId;

      if (createError) {
        // If creation failed, try to get existing one
        console.log(
          "Failed to create account, trying to fetch existing:",
          createError
        );

        const { data: existing } = await supabase
          .from("social_accounts")
          .select("id")
          .eq("workspace_id", currentWorkspace.id)
          .eq("platform", platform)
          .limit(1)
          .single();

        if (!existing) {
          alert(
            "Unable to set up social account. Please check your permissions."
          );
          setScheduling(null);
          return;
        }
        socialAccountId = existing.id;
      } else {
        socialAccountId = newAccount.id;
      }

      // Calculate schedule time (24 hours from now as default)
      const scheduledTime = new Date();
      scheduledTime.setHours(scheduledTime.getHours() + 24);

      const { data, error } = await supabase
        .from("scheduled_posts")
        .insert({
          workspace_id: currentWorkspace.id,
          post_id: postId,
          social_account_id: socialAccountId,
          scheduled_time: scheduledTime.toISOString(),
          status: "scheduled",
        })
        .select()
        .single();

      if (error) {
        console.error("Error scheduling post:", error);
        alert(`Failed to schedule post: ${error.message}`);
      } else {
        alert("Post scheduled successfully for tomorrow! 🎉");
        console.log("Scheduled post:", data);
      }
    } catch (error) {
      console.error("Caught error:", error);
      alert("An error occurred while scheduling the post.");
    } finally {
      setScheduling(null);
      setGenerating(false);
    }
  };

  const handleScheduleClick = async (postId: string) => {
    const post = generatedPosts.find((p) => p.id === postId);
    if (post) {
      setPostToReview(post);
      setSelectedPost(postId);

      // Default time set karen (next day 10 AM)
      const defaultTime = new Date();
      defaultTime.setDate(defaultTime.getDate() + 1);
      defaultTime.setHours(10, 0, 0, 0);
      setSelectedDateTime(defaultTime.toISOString().slice(0, 16));

      setShowReviewModal(true);
    }
  };

  const confirmSchedule = async () => {
    if (!selectedPost || !selectedDateTime || !currentWorkspace) return;

    setScheduling(selectedPost);

    try {
      // Create a demo social account directly first
      const { data: newAccount, error: createError } = await supabase
        .from("social_accounts")
        .insert({
          workspace_id: currentWorkspace.id,
          platform: platform,
          account_name: `Demo ${platform} Account`,
          account_id: `demo_${platform}_${Date.now()}`,
          is_active: true,
        })
        .select("id")
        .single();

      let socialAccountId;

      if (createError) {
        // If creation failed, try to get existing one
        console.log(
          "Failed to create account, trying to fetch existing:",
          createError
        );

        const { data: existing } = await supabase
          .from("social_accounts")
          .select("id")
          .eq("workspace_id", currentWorkspace.id)
          .eq("platform", platform)
          .limit(1)
          .single();

        if (!existing) {
          alert(
            "Unable to set up social account. Please check your permissions."
          );
          setScheduling(null);
          return;
        }
        socialAccountId = existing.id;
      } else {
        socialAccountId = newAccount.id;
      }

      const scheduledTime = new Date(selectedDateTime);

      const { data, error } = await supabase
        .from("scheduled_posts")
        .insert({
          workspace_id: currentWorkspace.id,
          post_id: selectedPost,
          social_account_id: socialAccountId,
          scheduled_time: scheduledTime.toISOString(),
          status: "scheduled",
        })
        .select()
        .single();

      if (error) {
        console.error("Error scheduling post:", error);
        alert(`Failed to schedule post: ${error.message}`);
      } else {
        alert(
          `Post scheduled successfully for ${scheduledTime.toLocaleString()}! 🎉`
        );
      }
    } catch (error) {
      console.error("Caught error:", error);
      alert("An error occurred while scheduling the post.");
    } finally {
      setScheduling(null);
      setShowReviewModal(false);
      setSelectedPost(null);
      setPostToReview(null);
    }
  };

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {generatedPosts.length > 0 ? "Generated Posts" : "No Posts Yet"}
            </h2>
            {generatedPosts.length > 0 && (
              <button
                onClick={loadRecentPosts}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            )}
          </div>

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
              {generatedPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Variant {post.variant_number}
                    </span>
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                        <RefreshCw className="w-4 h-4" />
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
                    <button
                      onClick={() => handleScheduleClick(post.id)}
                      disabled={scheduling === post.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scheduling === post.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          Schedule Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showReviewModal && postToReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Review & Schedule Post
              </h2>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Post Content Review */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Edit3 className="w-5 h-5" />
                  Post Content
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {postToReview.content}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {postToReview.content.length} characters
                </p>
              </div>

              {/* Schedule Time Picker */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schedule Time
                </h3>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={selectedDateTime}
                    onChange={(e) => setSelectedDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Scheduled for: {new Date(selectedDateTime).toLocaleString()}
                </p>
              </div>

              {/* Reminder Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-700">
                  💡 <strong>Reminder:</strong> You'll receive a notification 1
                  hour before posting to make any final edits if needed.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={!!scheduling}
                className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSchedule}
                disabled={!!scheduling || !selectedDateTime}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {scheduling ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Confirm Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
