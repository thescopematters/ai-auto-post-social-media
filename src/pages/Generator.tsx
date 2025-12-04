import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  contentApi,
  documentApi,
  socialAccountsApi,
  schedulerApi,
  mediaApi,
  workspaceApi,
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
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// Type Definitions
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
  created_at?: string;
  updated_at?: string;
};

type WorkspaceLimits = {
  aiGeneration?: {
    currentUsage: number;
    limit: number;
    remaining: number;
    canGenerate: boolean;
    planType: string;
    message?: string;
  };
  documentUpload?: {
    currentCount: number;
    limit: number;
    remaining: number;
    canUpload: boolean;
    message?: string;
  };
  weeklyPosting?: {
    postsThisWeek: number;
    limit: number;
    remaining: number;
    canPost: boolean;
    canPostNow: boolean; // Daily limit check
    nextResetDate?: string; // Rolling 7-day reset date
    message?: string;
    planType?: string;
  };
  linkedinRecommendation?: {
    idealFrequency: string;
    note: string;
  };
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
  const [isLoading, setIsLoading] = useState(true);
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
  const [workspaceLimits, setWorkspaceLimits] = useState<WorkspaceLimits | null>(null);
  const [_loadingLimits, setLoadingLimits] = useState(false);
  const [generatingAIImage, setGeneratingAIImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  useEffect(() => {
    console.log('Generator Component Mounted');
    console.log('Current Workspace:', currentWorkspace);
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      console.log('Workspace available, loading data...');
      setIsLoading(true);
      Promise.all([
        loadDocuments(),
        loadSocialAccounts(),
        loadWorkspaceLimits()
      ]).finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
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
      console.log('Loading documents for workspace:', currentWorkspace.id);
      const response = await documentApi.getAll(currentWorkspace.id, 1, 100);
      if (response.success && response.data) {
        const completedDocs = (response.data as any[]).filter(
          (doc) => doc.processing_status === "completed"
        );
        console.log('Loaded documents:', completedDocs.length);
        setDocuments(completedDocs);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    }
  };

  const loadSocialAccounts = async () => {
    if (!currentWorkspace) return;
    try {
      console.log('Loading social accounts for workspace:', currentWorkspace.id);
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
      toast.error("Failed to load social accounts");
    }
  };

  const loadWorkspaceLimits = async () => {
    if (!currentWorkspace) return;
    setLoadingLimits(true);
    try {
      console.log('Loading workspace limits for:', currentWorkspace.id);
      const response = await workspaceApi.getLimits(currentWorkspace.id);
      if (response.success && response.data) {
        console.log('Workspace limits:', response.data);
        setWorkspaceLimits(response.data as WorkspaceLimits);
      }
    } catch (error) {
      console.error("Error loading workspace limits:", error);
      toast.error("Failed to load workspace limits");
    } finally {
      setLoadingLimits(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDocument || !currentWorkspace) return;

    if (workspaceLimits?.aiGeneration && !workspaceLimits.aiGeneration.canGenerate) {
      toast.error("AI Generation Limit Reached", {
        description: workspaceLimits.aiGeneration.message,
      });
      return;
    }

    setGenerating(true);
    setGeneratedPosts([]);

    try {
      const response = await contentApi.generate(currentWorkspace.id, {
        documentId: selectedDocument,
        platform,
        tone,
        framework,
        variantCount: 1,
      });

      if (response.success && response.data) {
        let postsArray: GeneratedPost[] = [];

        if (Array.isArray((response.data as any).posts)) {
          postsArray = (response.data as any).posts;
        }

        if (postsArray.length > 0) {
          const postsWithFramework = postsArray.map((post) => ({
            ...post,
            framework: post.framework || framework,
            platform: post.platform || platform,
          }));

          setGeneratedPosts(postsWithFramework);
          setGenerating(false);
          await loadWorkspaceLimits();

          toast.success("Posts generated!", {
            description: `Created ${postsWithFramework.length} posts using ${FRAMEWORKS[framework].name} framework`,
          });
        } else {
          console.log("❌ No posts in response:", postsArray);
          setGenerating(false);
          toast.error("No posts were generated");
        }
      } else {
        console.log("❌ API response not successful:", response);
        setGenerating(false);
        toast.error("Failed to generate posts");
      }
    } catch (error: any) {
      console.error("Error generating content:", error);

      const errorMsg = error?.response?.data?.error || error?.message || "";

      if (errorMsg.includes("limit") || errorMsg.includes("exceeded")) {
        toast.error("AI Generation Limit Reached", {
          description: errorMsg,
          duration: 5000,
        });
        await loadWorkspaceLimits();
      } else {
        toast.error("Failed to generate posts", {
          description: errorMsg,
        });
      }
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

  const handleGenerateAIImage = async () => {
    if (!currentWorkspace || !editedContent.trim()) {
      toast.error("Post content is required to generate image");
      return;
    }

    setGeneratingAIImage(true);

    try {
      const response = await contentApi.generateImage(
        currentWorkspace.id,
        editedContent.substring(0, 500)
      );

      if (response.success && response.data?.imageUrl) {
        const imageData = response.data;

        const imageResponse = await fetch(imageData.imageUrl);
        const imageBlob = await imageResponse.blob();

        const imageFile = new File(
          [imageBlob],
          imageData.fileName || `ai-generated-${Date.now()}.jpg`,
          { type: imageData.mimeType || "image/jpeg" }
        );

        setModalImages((prev) => [...prev, imageFile]);
        setModalImagePreviews((prev) => [...prev, imageData.imageUrl]);

        toast.success("AI image generated successfully!");
      } else {
        toast.error(response.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error generating AI image:", error);
      const errorMsg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to generate AI image";
      toast.error(errorMsg);
    } finally {
      setGeneratingAIImage(false);
    }
  };

  const handleImagePreviewClick = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setShowImagePreview(true);
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

    // Check weekly limit
    if (workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPost) {
      toast.error("Weekly Post Limit Reached", {
        description: workspaceLimits.weeklyPosting.message ||
          "You've reached your weekly posting limit",
        duration: 5000,
      });
      return;
    }

    // Check daily limit
    if (workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPostNow) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      toast.error("Daily Post Limit Reached", {
        description: `You can only post once per day on the free plan. Please try again tomorrow (${tomorrow.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })}).`,
        duration: 5000,
      });
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
        await loadWorkspaceLimits();
        closeScheduleModal();
      } else {
        toast.error("Failed to publish post", {
          description: publishResponse.error || "Unknown error",
        });
      }
    } catch (error: any) {
      console.error("Error publishing post:", error);
      
      const errorMsg = error?.response?.data?.error || error?.message || "Error publishing post";
      
      if (errorMsg.includes("Daily post limit reached") || 
          errorMsg.includes("Daily posting limit exceeded") ||
          errorMsg.includes("24-hour")) {
        toast.error("Daily Post Limit Reached", {
          description: errorMsg,
          duration: 5000,
        });
      } else {
        toast.error("Error publishing post", {
          description: errorMsg,
        });
      }
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

    // Check weekly limit
    if (workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPost) {
      toast.error("Weekly Post Limit Reached", {
        description:
          workspaceLimits.weeklyPosting.message ||
          "You've reached your weekly posting limit. Upgrade to Pro for unlimited posts.",
        duration: 5000,
      });
      return;
    }

    const selectedDate = new Date(scheduledTime);
    const now = new Date();

    // Check if scheduled for today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const isScheduledForToday = selectedDate >= todayStart && selectedDate <= todayEnd;

    // If scheduling for today, check daily limit
    if (isScheduledForToday && workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPostNow) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      toast.error("Daily Post Limit Reached", {
        description: `You can only post once per day on the free plan. Please schedule for ${tomorrow.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })} or later.`,
        duration: 5000,
      });
      return;
    }

    // Validate future time
    if (selectedDate <= now) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);
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
        toast.success("Post scheduled successfully!", {
          description: isScheduledForToday 
            ? "Your post will be published today at the scheduled time."
            : `Your post will be published on ${selectedDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}.`
        });
        await loadWorkspaceLimits();
        closeScheduleModal();
      } else {
        toast.error("Failed to schedule post", {
          description: response.error,
        });
      }
    } catch (error: any) {
      console.error("Error scheduling post:", error);
      
      const errorMsg = error?.response?.data?.error || error?.message || "Error scheduling post";
      
      if (errorMsg.includes("Daily post limit reached") || 
          errorMsg.includes("Daily posting limit exceeded") ||
          errorMsg.includes("schedule this post for tomorrow")) {
        toast.error("Daily Post Limit Reached", {
          description: errorMsg,
          duration: 5000,
        });
      } else if (errorMsg.includes("Weekly post limit")) {
        toast.error("Weekly Post Limit Reached", {
          description: errorMsg,
          duration: 5000,
        });
      } else {
        toast.error("Error scheduling post", {
          description: errorMsg,
        });
      }
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

  // Format date for display (DD/MMM/YYYY)
  const formatResetDate = (dateString: string | undefined) => {
    if (!dateString) return "Not available";
    
    const date = new Date(dateString);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()}/${months[date.getMonth()]}/${date.getFullYear()}`;
  };

  const getFrameworkIcon = (frameworkKey: keyof typeof FRAMEWORKS) => {
    const FrameworkIcon = FRAMEWORKS[frameworkKey].icon;
    return <FrameworkIcon className="w-4 h-4" />;
  };

  const isPro = workspaceLimits?.aiGeneration?.planType === "pro";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 text-lg font-medium">Loading workspace...</p>
          <p className="text-gray-500 text-sm mt-2">Please wait while we set things up</p>
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">No workspace found</p>
          <p className="text-gray-500 text-sm mt-2">Please select a workspace to continue</p>
        </div>
      </div>
    );
  }

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

      {!isPro && workspaceLimits && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                Upgrade to Pro Plan
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Get unlimited AI generations, unlimited documents, and 100 posts
                per week
              </p>
              <button
                onClick={() => (window.location.href = "/subscription")}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

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

              {workspaceLimits && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  {workspaceLimits.aiGeneration && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">AI Generations Today:</span>
                        <span className="font-semibold text-gray-900">
                          {isPro ? (
                            <span className="text-purple-600">Unlimited ∞</span>
                          ) : (
                            `${workspaceLimits.aiGeneration.remaining}/${workspaceLimits.aiGeneration.limit}`
                          )}
                        </span>
                      </div>
                      {!isPro && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${
                                ((workspaceLimits.aiGeneration.limit - workspaceLimits.aiGeneration.remaining) /
                                  workspaceLimits.aiGeneration.limit) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceLimits.documentUpload && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">Documents:</span>
                        <span className="font-semibold text-gray-900">
                          {isPro ? (
                            <span className="text-purple-600">Unlimited ∞</span>
                          ) : (
                            `${workspaceLimits.documentUpload.remaining}/${workspaceLimits.documentUpload.limit}`
                          )}
                        </span>
                      </div>
                      {!isPro && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-green-600 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${
                                ((workspaceLimits.documentUpload.limit - workspaceLimits.documentUpload.remaining) /
                                  workspaceLimits.documentUpload.limit) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceLimits.weeklyPosting && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">Posts (Rolling 7 Days):</span>
                        <span className="font-semibold text-gray-900">
                          {`${Math.max(0, workspaceLimits.weeklyPosting.remaining)}/${workspaceLimits.weeklyPosting.limit}`}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            workspaceLimits.weeklyPosting.remaining <= 0
                              ? "bg-red-400"
                              : workspaceLimits.weeklyPosting.remaining <= 1
                              ? "bg-orange-500"
                              : "bg-orange-600"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              ((workspaceLimits.weeklyPosting.limit - workspaceLimits.weeklyPosting.remaining) /
                                workspaceLimits.weeklyPosting.limit) *
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      
                      {/* Daily limit warning */}
                      {!workspaceLimits.weeklyPosting.canPostNow && (
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Daily limit reached - try tomorrow
                        </p>
                      )}
                      
                      {/* Weekly reset date */}
                      {workspaceLimits.weeklyPosting.nextResetDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Resets on: {formatResetDate(workspaceLimits.weeklyPosting.nextResetDate)}
                        </p>
                      )}
                      
                      {/* Weekly limit reached */}
                      {!workspaceLimits.weeklyPosting.canPost && (
                        <p className="text-xs text-red-500 mt-1 font-medium">
                          ⚠️ Weekly limit reached
                        </p>
                      )}
                    </div>
                  )}

                  {!isPro && (
                    <div className="pt-2 border-t border-gray-200">
                      <button
                        onClick={() => (window.location.href = "/subscription")}
                        className="w-full text-xs py-2 px-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-medium"
                      >
                        ✨ Upgrade to Pro
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              {generatedPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Variant
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

      {showScheduleModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className="w-full max-w-6xl max-h-screen flex bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="w-1/2 flex flex-col overflow-hidden border-r border-gray-200">
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

              <div className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account
                  </label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    placeholder="Edit your post..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editedContent.length} characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Images
                  </label>

                  {modalImagePreviews.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition cursor-pointer">
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
                          <Image className="w-6 h-6 text-gray-400 mb-2" />
                          <p className="text-xs text-gray-600">
                            Click to upload
                          </p>
                        </label>
                      </div>

                      <button
                        onClick={handleGenerateAIImage}
                        disabled={generatingAIImage || !editedContent.trim()}
                        className="w-full h-full border-2 border-purple-300 rounded-lg p-4 hover:border-purple-400 transition flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingAIImage ? (
                          <RefreshCw className="w-6 h-6 text-purple-600 mb-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
                        )}
                        <p className="text-xs text-gray-600 text-center">
                          {generatingAIImage ? "Generating..." : "Generate using AI"}
                        </p>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {modalImagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              onClick={() => handleImagePreviewClick(preview)}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                            />
                            <button
                              onClick={() => handleRemoveModalImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition cursor-pointer text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        Add More
                      </label>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Publish
                  </h3>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setIsScheduleMode(false)}
                      className={`flex-1 py-2 rounded text-sm font-medium transition ${
                        !isScheduleMode
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      Now
                    </button>
                    <button
                      onClick={() => setIsScheduleMode(true)}
                      className={`flex-1 py-2 rounded text-sm font-medium transition ${
                        isScheduleMode
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      Schedule
                    </button>
                  </div>

                  {isScheduleMode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date & Time
                      </label>
                      
                      {/* Daily limit warning for today's schedule */}
                      {workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPostNow && (
                        <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-orange-800">
                              Daily limit reached for today
                            </p>
                            <p className="text-xs text-orange-700 mt-0.5">
                              Please schedule for tomorrow or later
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        min={minDateTimeString}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Min 5 minutes ahead
                        {workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPostNow && 
                          " • Schedule for tomorrow to avoid daily limit"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex gap-2 bg-gray-50 flex-shrink-0">
                <button
                  onClick={closeScheduleModal}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>

                {!isScheduleMode ? (
                  <button
                    onClick={handlePublishNow}
                    disabled={
                      !selectedAccount || scheduling !== null || uploading
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {uploading || scheduling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
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
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {uploading || scheduling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4" />
                        Schedule
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="w-1/2 flex flex-col bg-gray-50 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="text-sm font-semibold text-gray-900">
                  LinkedIn Preview
                </h3>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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

                  <div className="px-3 pb-3">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {editedContent || "Your post content will appear here..."}
                    </p>
                  </div>

                  {modalImagePreviews.length > 0 && (
                    <div
                      className={`grid gap-1 ${
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

                <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-600 mb-2">
                    <span>Characters</span>
                    <span className="font-medium">{editedContent.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
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

      {showImagePreview && previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="relative max-w-4xl max-h-screen">
            <button
              onClick={() => setShowImagePreview(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
            >
              <XIcon className="w-8 h-8" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-screen object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}