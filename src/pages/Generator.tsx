import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  contentApi,
  documentApi,
  socialAccountsApi,
  schedulerApi,
  mediaApi,
} from "../lib/apiClient";
import {
  Sparkles,
  Settings,
  Linkedin,
  RefreshCw,
  Calendar,
  Eye,
  BookOpen,
  Target,
  Anchor,
  RefreshCcw,
  Clock,
  Zap,
  Image,
  X as XIcon,
  Plus,
  Send,
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
  media_urls?: string[];
};

const FRAMEWORKS = {
  auto: {
    name: "Auto Select",
    icon: Sparkles,
    description: "AI chooses the best framework automatically",
  },
  hvcta: {
    name: "HVCTA",
    icon: Anchor,
    description: "(Hook → Value → Call to Action)",
  },
  pas: {
    name: "PAS",
    icon: Target,
    description: "(Problem → Agitate → Solution)",
  },
  sla: {
    name: "SLA",
    icon: BookOpen,
    description: "(Story → Lesson → Application)",
  },
  mrs: {
    name: "MRS",
    icon: RefreshCcw,
    description: "(Mistake → Realization → Shift)",
  },
  cms: { name: "CMS", icon: Clock, description: "(Chronological Micro-Story)" },
  htof: {
    name: "HTOF",
    icon: Zap,
    description: "(Hot Take / Opinion Framework)",
  },
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
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [modalImages, setModalImages] = useState<File[]>([]);
  const [modalImagePreviews, setModalImagePreviews] = useState<string[]>([]);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
      loadSocialAccounts();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      loadSocialAccounts();
    }
  }, [platform, currentWorkspace]);

  useEffect(() => {
    if (showScheduleModal || showPreviewModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showScheduleModal, showPreviewModal]);

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
        }
      }
    } catch (error) {
      console.error("Error loading social accounts:", error);
      setSocialAccounts([]);
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

      if (
        response.success &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const postsWithFramework = (response.data as GeneratedPost[]).map(
          (post) => ({
            ...post,
            framework: post.framework || framework,
            platform: post.platform || platform,
          })
        );
        setGeneratedPosts(postsWithFramework);
        toast.success("Posts generated!", {
          description: `Created ${postsWithFramework.length} posts using ${FRAMEWORKS[framework].name} framework`,
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate posts");
    } finally {
      setGenerating(false);
    }
  };

  const handleModalImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select only image files");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setModalImages((prev) => [...prev, file]);

      const reader = new FileReader();
      reader.onload = (e) => {
        setModalImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveModalImage = (index: number) => {
    setModalImages((prev) => prev.filter((_, i) => i !== index));
    setModalImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleScheduleClick = (post: GeneratedPost) => {
    setSelectedPost(post);
    setEditedContent(post.content);
    setModalImages([]);
    setModalImagePreviews([]);
    setIsScheduleMode(false);
    setScheduledTime("");
    setShowScheduleModal(true);
  };

  const handlePreviewClick = (post: GeneratedPost) => {
    setSelectedPost(post);
    setShowPreviewModal(true);
  };

  const uploadPostImages = async () => {
    if (!selectedPost || !currentWorkspace || modalImages.length === 0)
      return true;

    setUploading(true);
    try {
      const formData = new FormData();
      modalImages.forEach((image) => {
        formData.append("media", image);
      });

      const response = await mediaApi.uploadMedia(
        currentWorkspace.id,
        selectedPost.id,
        formData
      );

      if (response.success) {
        toast.success("Images uploaded successfully");
        return true;
      } else {
        toast.error("Failed to upload images");
        return false;
      }
    } catch (error: any) {
      console.error("Error uploading images:", error);
      toast.error("Error uploading images");
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!selectedPost || !currentWorkspace || !selectedAccount) {
      toast.error("Please select a social account first");
      return;
    }

    setScheduling(selectedPost.id);

    try {
      if (editedContent !== selectedPost.content) {
        const updateResponse = await contentApi.updatePost(
          currentWorkspace.id,
          selectedPost.id,
          { content: editedContent }
        );

        if (!updateResponse.success) {
          throw new Error("Failed to update content");
        }
      }

      if (modalImages.length > 0) {
        const uploadSuccess = await uploadPostImages();
        if (!uploadSuccess) {
          throw new Error("Failed to upload images");
        }
      }

      const publishResponse = await schedulerApi.publishNow({
        postId: selectedPost.id,
        socialAccountId: selectedAccount,
      });

      if (publishResponse.success) {
        toast.success("Post published successfully!");
        closeScheduleModal();
      } else {
        toast.error("Failed to publish post", {
          description: publishResponse.error || "Unknown error",
        });
      }
    } catch (error: any) {
      console.error("Error publishing post:", error);
      toast.error("Error publishing post", {
        description: error.message,
      });
    } finally {
      setScheduling(null);
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

    const selectedDate = new Date(scheduledTime);
    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);

    if (selectedDate <= now) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    if (selectedDate < minScheduleTime) {
      toast.error("Scheduled time must be at least 5 minutes in the future");
      return;
    }

    setScheduling(selectedPost.id);

    try {
      if (editedContent !== selectedPost.content) {
        const updateResponse = await contentApi.updatePost(
          currentWorkspace.id,
          selectedPost.id,
          { content: editedContent }
        );

        if (!updateResponse.success) {
          throw new Error("Failed to update content");
        }
      }

      if (modalImages.length > 0) {
        const uploadSuccess = await uploadPostImages();
        if (!uploadSuccess) {
          throw new Error("Failed to upload images");
        }
      }

      const response = await contentApi.schedulePost(currentWorkspace.id, {
        postId: selectedPost.id,
        socialAccountId: selectedAccount,
        scheduledTime: new Date(scheduledTime).toISOString(),
      });

      if (response.success) {
        toast.success("Post scheduled successfully!");
        closeScheduleModal();
      } else {
        toast.error("Failed to schedule post", {
          description: response.error,
        });
      }
    } catch (error: any) {
      console.error("Error scheduling post:", error);
      toast.error("Error scheduling post", {
        description: error.message,
      });
    } finally {
      setScheduling(null);
    }
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setSelectedPost(null);
    setEditedContent("");
    setModalImages([]);
    setModalImagePreviews([]);
    setScheduledTime("");
    setIsScheduleMode(false);
  };

  const filteredAccounts = socialAccounts.filter(
    (account) => account.platform === platform && account.is_active
  );

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5);
  const minDateTimeString = minDateTime.toISOString().slice(0, 16);

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
          Create engaging social media posts from your documents using proven
          frameworks
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
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
                      className="w-full p-4 rounded-lg border-2 border-gray-200 opacity-50 cursor-not-allowed"
                    >
                      <svg
                        className="w-6 h-6 mx-auto mb-2 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span className="block text-sm font-medium">Twitter</span>
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
                  onChange={(e) =>
                    setFramework(e.target.value as keyof typeof FRAMEWORKS)
                  }
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

        {/* Generated Posts Panel */}
        <div className="lg:col-span-2">
          {generatedPosts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No posts generated yet
              </h3>
              <p className="text-gray-600 mb-6">
                Select a document and click generate to create AI-powered
                content using {FRAMEWORKS[framework].name} framework
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
                  key={post.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Variant {post.variant_number || index + 1}
                      </span>
                      {post.framework &&
                        FRAMEWORKS[
                          post.framework as keyof typeof FRAMEWORKS
                        ] && (
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-semibold flex items-center gap-1 border border-purple-200">
                            {getFrameworkIcon(
                              post.framework as keyof typeof FRAMEWORKS
                            )}
                            {
                              FRAMEWORKS[
                                post.framework as keyof typeof FRAMEWORKS
                              ].name
                            }
                          </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewClick(post)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>

                      <button
                        onClick={() => handleScheduleClick(post)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
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

      {/* Schedule Modal - Side by Side Layout */}
      {showScheduleModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className="w-full max-w-3xl max-h-screen flex bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Left Side - Form */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Prepare Post
                  </h2>
                  <p className="text-xs text-gray-500">
                    Edit, add images & publish
                  </p>
                </div>
                <button
                  onClick={closeScheduleModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
                {/* Account Selection */}
                <div>
                  <label className="block text-xm font-medium text-gray-700 mb-1">
                    Account
                  </label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xm"
                  >
                    {filteredAccounts.length === 0 ? (
                      <option value="">No active accounts</option>
                    ) : (
                      filteredAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Post Content */}
                <div>
                  <label className="block text-xm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-xm"
                    placeholder="Edit your post..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editedContent.length} characters
                  </p>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xm font-medium text-gray-700 mb-1">
                    Images
                  </label>

                  {modalImagePreviews.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-gray-400 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleModalImageUpload}
                          className="hidden"
                          id="modal-image-upload"
                        />
                        <label
                          htmlFor="modal-image-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <Image className="w-5 h-5 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-600">
                            Click to upload
                          </p>
                        </label>
                      </div>

                      <div
                        className="relative"
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                      >
                        <button
                          disabled
                          className="w-full h-full border-2 border-gray-300 rounded-lg p-3 opacity-50 cursor-not-allowed flex flex-col items-center justify-center"
                        >
                          <Sparkles className="w-5 h-5 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-600 whitespace-nowrap">
                            Generate using AI
                          </p>
                        </button>

                        {showTooltip && (
                          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none">
                            Coming Soon
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {modalImagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              onClick={() => handleRemoveModalImage(index)}
                              className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleModalImageUpload}
                        className="hidden"
                        id="add-more-modal-images"
                      />
                      <label
                        htmlFor="add-more-modal-images"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition cursor-pointer text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        Add More
                      </label>
                    </div>
                  )}
                </div>

                {/* Publishing Options */}
                <div className="border-t border-gray-200 pt-3">
                  <h3 className="text-xm font-semibold text-gray-900 mb-2">
                    Publish
                  </h3>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setIsScheduleMode(false)}
                      className={`flex-1 py-1.5 rounded text-xm font-medium transition ${
                        !isScheduleMode
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      Now
                    </button>
                    <button
                      onClick={() => setIsScheduleMode(true)}
                      className={`flex-1 py-1.5 rounded text-xm font-medium transition ${
                        isScheduleMode
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      Schedule
                    </button>
                  </div>

                  {isScheduleMode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <label className="block text-xm font-medium text-gray-700 mb-1">
                        Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        min={minDateTimeString}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Min 5 minutes ahead
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Action Buttons */}
              <div className="p-4 border-t border-gray-200 flex gap-2 bg-gray-50 flex-shrink-0">
                <button
                  onClick={closeScheduleModal}
                  className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-xm"
                >
                  Cancel
                </button>

                {!isScheduleMode ? (
                  <button
                    onClick={handlePublishNow}
                    disabled={
                      !selectedAccount || scheduling !== null || uploading
                    }
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-xm font-medium"
                  >
                    {uploading || scheduling ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" />
                        Publish Now
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSchedulePost}
                    disabled={
                      !selectedAccount ||
                      !scheduledTime ||
                      scheduling !== null ||
                      uploading
                    }
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-xm font-medium"
                  >
                    {uploading || scheduling ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3 h-3" />
                        Schedule
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Right Side - Preview */}
            <div className="w-96 flex flex-col bg-gray-50 overflow-hidden">
              {/* Preview Header */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="text-sm font-semibold text-gray-900">
                  LinkedIn Preview
                </h3>
              </div>

              {/* Preview Content */}
              <div className="p-4 overflow-y-auto flex-1">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Profile Section */}
                  <div className="p-3 flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {filteredAccounts
                        .find((a) => a.id === selectedAccount)
                        ?.account_name?.charAt(0)
                        ?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {filteredAccounts.find((a) => a.id === selectedAccount)
                          ?.account_name || "User"}
                      </p>
                      <p className="text-xs text-gray-500">Now</p>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="px-3 pb-3">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {editedContent || "Your post content will appear here..."}
                    </p>
                  </div>

                  {/* Images Preview */}
                  {modalImagePreviews.length > 0 && (
                    <div
                      className={`grid gap-3 ${
                        modalImagePreviews.length === 1
                          ? "grid-cols-1"
                          : "grid-cols-2"
                      }`}
                    >
                      {modalImagePreviews.slice(0, 4).map((preview, index) => (
                        <div
                          key={index}
                          className="relative aspect-square overflow-hidden"
                        >
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === 3 && modalImagePreviews.length > 4 && (
                            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                              <span className="text-white text-lg font-bold">
                                +{modalImagePreviews.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Character Info */}
                <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-600 mb-2">
                    <span>Characters</span>
                    <span className="font-medium">{editedContent.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (editedContent.length / 3000) * 100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className="flex items-center justify-center w-full max-h-screen">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-xl max-h-screen flex flex-col">
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-900">
                  Preview Post
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-gray-600">
                    Platform: {selectedPost.platform || "LinkedIn"}
                  </p>
                  {selectedPost.framework && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xm font-medium">
                      {FRAMEWORKS[
                        selectedPost.framework as keyof typeof FRAMEWORKS
                      ]?.name || selectedPost.framework}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
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
                    <p className="text-gray-900">
                      {selectedPost.variant_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Character Count</p>
                    <p className="text-gray-900">
                      {selectedPost.content.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Framework</p>
                    <p className="text-gray-900">
                      {FRAMEWORKS[
                        selectedPost.framework as keyof typeof FRAMEWORKS
                      ]?.name ||
                        selectedPost.framework ||
                        "Auto"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
