import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  AlertCircle,
  Copy,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

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
  photo?: string | null;
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
    canPostNow: boolean;
    nextResetDate?: string;
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
  const { currentWorkspace, profile } = useAuth();
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
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [modalImages, setModalImages] = useState<(File | string)[]>([]);
  const [modalImagePreviews, setModalImagePreviews] = useState<string[]>([]);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [workspaceLimits, setWorkspaceLimits] = useState<WorkspaceLimits | null>(null);
  const [_loadingLimits, setLoadingLimits] = useState(false);
  const [generatingAIImage, setGeneratingAIImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isDrafting, setIsDrafting] = useState(false);
  const [characterLimit, setCharacterLimit] = useState(1000);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>("");

  const quillRef = useRef<ReactQuill>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Helper function to strip HTML tags for character count and plain text
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  // Strip AI-generated markdown bold and HTML bold (requested by user to not show bold in list)
  const markdownToHtml = (markdown: string) => {
    if (!markdown) return "";
    // Robust replacement for **bold** and __bold__
    let clean = markdown
      .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
      .replace(/__([\s\S]*?)__/g, "$1");

    // Also strip literal <strong> and <b> tags if AI included them
    clean = clean
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "$1");

    return clean;
  };

  // Convert plain text with newlines to HTML for ReactQuill
  const textToHtml = (text: string) => {
    if (!text) return "";
    const clean = markdownToHtml(text);

    // Split by double newlines or more to identify "true" paragraph breaks
    // and then handle single newlines within those blocks
    return clean
      .split(/\n\s*\n/)
      .map(block => {
        const lines = block.trim().split('\n');
        const content = lines.join('<br>');
        return `<p>${content}</p>`;
      })
      .join("");
  };

  useEffect(() => {
    const loadDraft = async () => {
      const draftId = searchParams.get("draftId");
      if (draftId && currentWorkspace && !selectedPost) {
        try {
          const response = await contentApi.getPostById(currentWorkspace.id, draftId);
          if (response.success && response.data) {
            const post = response.data as any; // Cast to any to access dynamic fields
            setSelectedPost(post);
            // Use existing textToHtml (defined later) or markdownToHtml
            // Since textToHtml is defined later and we are inside useEffect using closure or hoisting? 
            // `const` is block scoped and not hoisted.
            // I should verify if I can access the later defined textToHtml here.
            // Actually, I should probably MOVE the robust textToHtml up, or rely on it being defined outside if it were a function declaration.
            // But it's a const arrow function.
            // To be safe, I'll use a simple replacement here or just move the definition UP.
            // Since I am deleting the one here, I should probably MOVe the other one here.

            // Wait, existing code has `textToHtml` at line 261. I cannot use it at line 194 if it's defined at 261 (const).
            // So I should REPLACE this duplicate with the ROBUST one from 261, and delete 261.
            setEditedContent(post.content || "");

            if (post.media_urls && post.media_urls.length > 0) {
              setModalImages(post.media_urls);
              setModalImagePreviews(post.media_urls);
            }
            setShowScheduleModal(true);
            navigate(location.pathname, { replace: true });
          }
        } catch (e) { console.error("Error loading draft", e) }
      }
    }
    loadDraft();
  }, [currentWorkspace, searchParams]);

  const LOADING_MESSAGES = [
    "Warming up the AI's creative neurons...",
    "Brewing a fresh post. Almost there.",
    "Teaching the AI to be witty. One second.",
    "Generating scroll-stopping content...",
    "Turning ideas into engagement...",
    "Convincing the AI this post needs to go viral.",
    "Asking the AI for its best social voice.",
    "Polishing words. Removing cringe.",
    "Aligning hashtags with the universe.",
    "Creativity in progress. Please stand by.",
  ];

  // Quill modules configuration
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



  // Convert HTML to LinkedIn-compatible Unicode bold/italic
  const prepareContentForSocial = (html: string) => {
    if (!html) return "";

    const boldMap: { [key: string]: string } = {
      'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
      'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
      '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };

    const convertToUnicodeBold = (text: string) => {
      return text.split('').map(char => boldMap[char] || char).join('');
    };

    // Use a container to parse the HTML string
    const container = document.createElement('div');
    container.innerHTML = html;

    // Recursive function to process text nodes within bold tags
    const processNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && (node.parentElement?.tagName === 'STRONG' || node.parentElement?.tagName === 'B')) {
        node.textContent = convertToUnicodeBold(node.textContent || "");
      }
      node.childNodes.forEach(processNodes);
    };

    processNodes(container);

    // Clean up HTML tags but preserve line structure
    let content = container.innerHTML;

    // Replace <p> with newlines
    content = content.replace(/<\/p><p>/g, '\n\n');
    content = content.replace(/<p>/g, '');
    content = content.replace(/<\/p>/g, '\n');

    // Replace <br> with newlines
    content = content.replace(/<br\s*\/?>/gi, '\n');

    // Strip any remaining tags
    const finalTmp = document.createElement('div');
    finalTmp.innerHTML = content;
    return finalTmp.textContent?.trim() || "";
  };

  useEffect(() => {
    console.log('Generator Component Mounted');
    console.log('Current Workspace:', currentWorkspace);
  }, []);

  useEffect(() => {
    if (currentWorkspace?.id) {
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
    if (currentWorkspace?.id) {
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

  const handleGenerateIdeas = async () => {
    if (!currentWorkspace) return;
    setIsGeneratingIdeas(true);
    try {
      const response = await contentApi.generateIdeas(currentWorkspace.id);
      if (response.success && response.data?.ideas) {
        setIdeas(response.data.ideas);
        toast.success("10 fresh ideas generated based on your role!");
      } else {
        toast.error("Failed to generate ideas");
      }
    } catch (error) {
      console.error("Error generating ideas:", error);
      toast.error("Error generating ideas");
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentWorkspace) return;

    if (!selectedDocument && !selectedTopic) {
      toast.error("Please select a document or an idea first");
      return;
    }

    if (workspaceLimits?.aiGeneration && !workspaceLimits.aiGeneration.canGenerate) {
      toast.error("AI Generation Limit Reached", {
        description: workspaceLimits.aiGeneration.message,
      });
      return;
    }

    setGenerating(true);
    setGeneratedPosts([]);
    setSelectedVariantIndex(0);
    setLoadingMessageIndex(0);

    const messageInterval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    try {
      const response = await contentApi.generate(currentWorkspace.id, {
        documentId: selectedDocument || undefined,
        topic: selectedTopic || undefined,
        platform,
        tone,
        framework,
        variantCount: 1,
        characterLimit,
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
          await loadWorkspaceLimits();

          toast.success("Posts generated!", {
            description: `Created ${postsWithFramework.length} posts using ${FRAMEWORKS[framework].name} framework`,
          });
        } else {
          console.log("❌ No posts in response:", postsArray);
          toast.error("No posts were generated");
        }
      } else {
        console.log("❌ API response not successful:", response);
        toast.error("Failed to generate posts");
      }
    } catch (error: any) {
      console.error("Error generating content:", error);
      const errorMsg = error?.response?.data?.error || error?.message || "Failed to generate posts";
      toast.error(errorMsg);
    } finally {
      setGenerating(false);
      clearInterval(messageInterval);
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
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Image size should be less than 50MB");
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
      const plainText = stripHtml(editedContent);
      const response = await contentApi.generateImage(
        currentWorkspace.id,
        plainText.substring(0, 500)
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
    // Convert newlines to paragraphs for ReactQuill to maintain spacing
    setEditedContent(textToHtml(post.content));
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

  const handleCopyPost = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Post copied to clipboard!");
  };

  const uploadPostImages = async () => {
    if (!selectedPost || !currentWorkspace || modalImages.length === 0)
      return true;

    setUploading(true);
    try {
      const formData = new FormData();
      modalImages.forEach((image) => {
        if (image instanceof File) {
          formData.append("media", image);
        }
      });

      // If no new files to upload, return true immediately (unless we were just deleting? existing logic handles additions)
      // Actually if no files, formData is empty. 
      const hasFiles = modalImages.some(img => img instanceof File);
      if (!hasFiles) {
        setUploading(false);
        return true;
      }

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

    if (workspaceLimits?.weeklyPosting && !workspaceLimits.weeklyPosting.canPost) {
      toast.error("Weekly Post Limit Reached", {
        description: workspaceLimits.weeklyPosting.message ||
          "You've reached your weekly posting limit",
        duration: 5000,
      });
      return;
    }

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
      const socialContent = prepareContentForSocial(editedContent);

      if (socialContent !== selectedPost.content) {
        const updateResponse = await contentApi.updatePost(
          currentWorkspace.id,
          selectedPost.id,
          { content: socialContent }
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

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const isScheduledForToday = selectedDate >= todayStart && selectedDate <= todayEnd;

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
      const socialContent = prepareContentForSocial(editedContent);

      if (socialContent !== selectedPost.content) {
        const updateResponse = await contentApi.updatePost(
          currentWorkspace.id,
          selectedPost.id,
          { content: socialContent }
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

  const handleSaveDraft = async () => {
    if (!selectedPost || !currentWorkspace) return;

    setIsDrafting(true);
    try {
      // First ensure images are uploaded if any
      const imageUploadSuccess = await uploadPostImages();
      if (!imageUploadSuccess) {
        setIsDrafting(false);
        return;
      }

      // Update content first
      await contentApi.updatePost(currentWorkspace.id, selectedPost.id, {
        content: stripHtml(editedContent),
      });

      // Then mark as draft
      const response = await contentApi.draftPost(
        currentWorkspace.id,
        selectedPost.id
      );

      if (response.success) {
        toast.success("Post saved as draft");
        closeScheduleModal(); // Use the existing close function
      } else {
        toast.error("Failed to save draft");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsDrafting(false);
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
    <div className="h-[calc(100vh-72px)] flex flex-col p-6 lg:p-8 max-w-[1600px] mx-auto overflow-hidden">

      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Content Generator
        </h1>
        <p className="text-gray-600">
          Create engaging social media posts from your documents using proven
          frameworks
        </p>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-full flex flex-col min-h-0">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Configuration
              </h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Source Content
                    </label>
                    <button
                      onClick={handleGenerateIdeas}
                      disabled={isGeneratingIdeas}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-lg transition-colors border border-purple-100 disabled:opacity-50"
                    >
                      {isGeneratingIdeas ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{isGeneratingIdeas ? "Generating..." : "Get AI Ideas"}</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1 ml-1 uppercase tracking-wider">
                        From Your Documents
                      </label>
                      <select
                        value={selectedDocument ? `doc:${selectedDocument}` : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setSelectedDocument("");
                            return;
                          }
                          const value = val.substring(val.indexOf(":") + 1);
                          setSelectedDocument(value);
                          setSelectedTopic(""); // Clear topic when document is selected
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-sm"
                      >
                        <option value="">Select a document</option>
                        {documents.map((doc) => (
                          <option key={doc.id} value={`doc:${doc.id}`}>
                            📄 {doc.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(ideas.length > 0 || isGeneratingIdeas) && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                        <label className="block text-[10px] font-medium text-purple-500 mb-1 ml-1 uppercase tracking-wider">
                          From AI Suggested Ideas
                        </label>
                        <select
                          value={selectedTopic ? `topic:${selectedTopic}` : ""}
                          disabled={isGeneratingIdeas}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setSelectedTopic("");
                              return;
                            }
                            const value = val.substring(val.indexOf(":") + 1);
                            setSelectedTopic(value);
                            setSelectedDocument(""); // Clear document when topic is selected
                          }}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white text-sm ${isGeneratingIdeas ? "border-purple-200 opacity-60" : "border-gray-300"
                            }`}
                        >
                          <option value="">{isGeneratingIdeas ? "⏳ Generating ideas..." : "Select an AI idea"}</option>
                          {ideas.map((idea, index) => (
                            <option key={index} value={`topic:${idea}`}>
                              💡 {idea}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedTopic && !ideas.includes(selectedTopic) && (
                      <div className="p-3 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700 font-medium text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                        <span className="truncate mr-2">Custom Topic: {selectedTopic}</span>
                        <button onClick={() => setSelectedTopic("")}>
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Platform
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setPlatform("linkedin")}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 ${platform === "linkedin"
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                        : "border-gray-100 bg-gray-50 hover:border-gray-300"
                        }`}
                    >
                      <Linkedin
                        className={`w-5 h-5 mx-auto mb-1.5 ${platform === "linkedin"
                          ? "text-blue-600"
                          : "text-gray-400"
                          }`}
                      />
                      <span className={`block text-xs font-semibold ${platform === "linkedin" ? "text-blue-700" : "text-gray-600"}`}>LinkedIn</span>
                    </button>

                    <div
                      className="relative"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <button
                        disabled
                        className="w-full p-3 rounded-xl border-2 border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      >
                        <svg
                          className="w-5 h-5 mx-auto mb-1.5 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="block text-xs font-semibold text-gray-400">Twitter</span>
                      </button>

                      {showTooltip && (
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl">
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    {Object.entries(FRAMEWORKS).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.name}
                        {config.description}
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="thought_leader">Thought Leader</option>
                    <option value="educational">Educational</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Length: <span className="text-blue-600 font-semibold">{characterLimit}</span> characters
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="2500"
                    step="100"
                    value={characterLimit}
                    onChange={(e) => setCharacterLimit(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>500 (Short)</span>
                    <span>1000 (Default)</span>
                    <span>2500 (Long)</span>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-white space-y-3 flex-shrink-0">
              <button
                onClick={handleGenerate}
                disabled={(!selectedDocument && !selectedTopic) || generating || !workspaceLimits?.aiGeneration?.canGenerate}
                className={`w-full flex flex-col items-center justify-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold shadow-lg relative overflow-hidden group ${((!selectedDocument && !selectedTopic) || generating || !workspaceLimits?.aiGeneration?.canGenerate)
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5"
                  }`}
              >
                {generating ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm">Generate Posts</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                  </>
                )}
              </button>

              <div className="space-y-3 pt-1">
                {workspaceLimits && workspaceLimits.aiGeneration && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-gray-500 font-medium">AI Generations Today:</span>
                      <span className="font-bold text-gray-900">
                        {isPro ? (
                          <span className="text-purple-600">Unlimited ∞</span>
                        ) : (
                          `${workspaceLimits.aiGeneration.remaining}/${workspaceLimits.aiGeneration.limit}`
                        )}
                      </span>
                    </div>
                    {!isPro && workspaceLimits.aiGeneration.limit > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                          style={{
                            width: `${((workspaceLimits.aiGeneration.limit - workspaceLimits.aiGeneration.remaining) /
                              workspaceLimits.aiGeneration.limit) *
                              100
                              }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {workspaceLimits && workspaceLimits.documentUpload && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-gray-500 font-medium">Documents:</span>
                      <span className="font-bold text-gray-900">
                        {isPro ? (
                          <span className="text-purple-600">Unlimited ∞</span>
                        ) : (
                          `${workspaceLimits.documentUpload.remaining}/${workspaceLimits.documentUpload.limit}`
                        )}
                      </span>
                    </div>
                    {!isPro && workspaceLimits.documentUpload.limit > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className="bg-green-500 h-1 rounded-full transition-all duration-500"
                          style={{
                            width: `${((workspaceLimits.documentUpload.limit - workspaceLimits.documentUpload.remaining) /
                              workspaceLimits.documentUpload.limit) *
                              100
                              }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {workspaceLimits && workspaceLimits.weeklyPosting && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-gray-500 font-medium">Posts (Rolling 7 Days):</span>
                      <span className="font-bold text-gray-900">
                        {`${Math.max(0, workspaceLimits.weeklyPosting.remaining)}/${workspaceLimits.weeklyPosting.limit}`}
                      </span>
                    </div>
                    {workspaceLimits.weeklyPosting.limit > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all duration-500 ${workspaceLimits.weeklyPosting.remaining <= 0
                            ? "bg-red-400"
                            : workspaceLimits.weeklyPosting.remaining <= 1
                              ? "bg-orange-400"
                              : "bg-orange-500"
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
                    )}
                    {workspaceLimits.weeklyPosting.nextResetDate && (
                      <p className="text-[9px] text-gray-400 mt-1">
                        Resets on: {formatResetDate(workspaceLimits.weeklyPosting.nextResetDate)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!isPro && (
                <button
                  onClick={() => (window.location.href = "/subscription")}
                  className="w-full text-xs py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-bold shadow-md shadow-purple-100 mt-2"
                >
                  ✨ Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 h-full flex flex-col min-h-0">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                Generated Variants
              </h2>
              {generatedPosts.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePreviewClick(generatedPosts[selectedVariantIndex])}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-[11px] font-bold shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => handleScheduleClick(generatedPosts[selectedVariantIndex])}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-[11px] font-bold shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                    {getFrameworkIcon(framework)}
                    {FRAMEWORKS[framework].name}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/30">
              {generating ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-blue-50 rounded-full animate-ping absolute inset-0 opacity-20" />
                    <div className="w-24 h-24 bg-white rounded-3xl shadow-lg border border-blue-100 flex items-center justify-center relative z-10">
                      <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 animate-pulse">
                    Crafting your content...
                  </h3>
                  <p className="text-blue-600 font-medium text-sm max-w-sm leading-relaxed bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </p>
                </div>
              ) : generatedPosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-gray-200" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Ready to create?
                  </h3>
                  <p className="text-gray-500 mb-8 max-w-sm text-sm leading-relaxed">
                    Select a document and click generate to create AI-powered
                    content using the {FRAMEWORKS[framework].name} framework.
                  </p>
                  {documents.length === 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-full text-xs font-bold border border-yellow-100">
                      <AlertCircle className="w-4 h-4" />
                      Please upload documents first
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {generatedPosts.map((post, index) => (
                    <div
                      key={index}
                      className="group/card animate-fade-in cursor-pointer"
                      onClick={() => setSelectedVariantIndex(index)}
                    >
                      <div className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${selectedVariantIndex === index
                        ? "border-blue-500 shadow-md ring-2 ring-blue-100"
                        : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
                        }`}>
                        {/* Top bar with variant label and actions */}
                        <div className={`p-4 border-b flex items-center justify-between transition-colors ${selectedVariantIndex === index ? "border-blue-100 bg-blue-50/30" : "border-gray-100 bg-gray-50/30"
                          }`}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPost(post.content);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all text-[11px] font-bold shadow-sm"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Content area */}
                        <div className="p-6">
                          <div
                            className="text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px] linkedin-preview-content prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showScheduleModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50 overflow-hidden">
          <div className="w-[92vw] max-w-[1440px] h-[95vh] max-h-[95vh] flex bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="w-[55%] flex flex-col overflow-hidden border-r border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Prepare Post
                  </h2>
                  <p className="text-xs text-gray-500">
                    Edit, add images & publish
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1 text-sm flex flex-col">
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

                <div className="flex-1 flex flex-col mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex-shrink-0">
                    Edit Content
                  </label>
                  <div className="quill-editor-container flex-1 flex flex-col border border-gray-200 rounded-lg">
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={editedContent}
                      onChange={setEditedContent}
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="Edit your post..."
                      className="h-full flex flex-col"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex-shrink-0">
                    {stripHtml(editedContent).length} characters
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Images
                  </label>

                  {modalImagePreviews.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition cursor-pointer relative">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleModalImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="modal-image-upload"
                        />
                        <div className="flex flex-col items-center pointer-events-none">
                          <Image className="w-6 h-6 text-gray-400 mb-2" />
                          <p className="text-xs text-gray-600">
                            Click to upload
                          </p>
                        </div>
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
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {modalImagePreviews.map((preview, index) => (
                          <div key={index} className="relative group aspect-square">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              onClick={() => handleImagePreviewClick(preview)}
                              className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                            />
                            <button
                              onClick={() => handleRemoveModalImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100 shadow-sm"
                            >
                              <XIcon className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleModalImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            id="add-more-modal-images"
                          />
                          <button
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition text-xs font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Upload
                          </button>
                        </div>

                        <button
                          onClick={handleGenerateAIImage}
                          disabled={generatingAIImage || !editedContent.trim()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                        >
                          {generatingAIImage ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Generate AI
                        </button>
                      </div>
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
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition ${!isScheduleMode
                        ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                        : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      Now
                    </button>
                    <button
                      onClick={() => setIsScheduleMode(true)}
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition ${isScheduleMode
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

                      {workspaceLimits?.weeklyPosting?.canPostNow === false && (
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
                        onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                        min={minDateTimeString}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-xs cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Min 5 minutes ahead
                        {workspaceLimits?.weeklyPosting?.canPostNow === false &&
                          " • Schedule for tomorrow to avoid daily limit"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button
                  onClick={handleSaveDraft}
                  disabled={uploading || isDrafting}
                  className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-xs flex items-center gap-2"
                >
                  {isDrafting ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Save Draft
                </button>
                <button
                  onClick={closeScheduleModal}
                  className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-xs"
                >
                  Close
                </button>

                {!isScheduleMode ? (
                  <button
                    onClick={handlePublishNow}
                    disabled={
                      !selectedAccount || scheduling !== null || uploading
                    }
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
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
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
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

            <div className="w-[45%] flex flex-col bg-gray-50 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0 relative">
                <h3 className="text-lg font-bold text-gray-900">
                  LinkedIn Preview
                </h3>
                <p className="text-xs text-gray-500">
                  Visual representation of your post
                </p>
                <button
                  onClick={closeScheduleModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 flex items-center gap-2">
                    {filteredAccounts.find((a) => a.id === selectedAccount)?.photo || profile?.avatar_url ? (
                      <img
                        src={filteredAccounts.find((a) => a.id === selectedAccount)?.photo || profile?.avatar_url || ""}
                        alt={filteredAccounts.find((a) => a.id === selectedAccount)?.account_name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {filteredAccounts
                          .find((a) => a.id === selectedAccount)
                          ?.account_name?.charAt(0)
                          ?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {filteredAccounts.find((a) => a.id === selectedAccount)
                          ?.account_name || "User"}
                      </p>
                      <p className="text-xs text-gray-500">Now</p>
                    </div>
                  </div>

                  <div className="px-3 pb-3">
                    <div
                      className="text-gray-800 text-sm leading-relaxed linkedin-preview-content max-w-none"
                      dangerouslySetInnerHTML={{ __html: editedContent || "Your post content will appear here..." }}
                    />
                  </div>

                  {modalImagePreviews.length > 0 && (
                    <div
                      className={`grid gap-1 ${modalImagePreviews.length === 1
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

                  <div className="border-t border-gray-100 mt-2">
                    <div className="flex items-center justify-around py-1">
                      <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                        <ThumbsUp className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Like</span>
                      </button>
                      <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                        <MessageSquare className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Comment</span>
                      </button>
                      <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                        <Repeat2 className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Repost</span>
                      </button>
                      <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                        <Send className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Send</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-600 mb-2">
                    <span>Characters</span>
                    <span className="font-medium">{stripHtml(editedContent).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {
        showPreviewModal && selectedPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
            <div className="flex items-center justify-center w-full max-h-screen">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Preview Post
                  </h2>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4">
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
                    <div className="text-right">
                      <p className="text-gray-600 text-sm font-medium">
                        Characters: <span className="text-gray-900">{selectedPost.content.length}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                  <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 flex items-center gap-2">
                      {filteredAccounts.find((a) => a.id === selectedAccount)?.photo ? (
                        <img
                          src={filteredAccounts.find((a) => a.id === selectedAccount)?.photo!}
                          alt={filteredAccounts.find((a) => a.id === selectedAccount)?.account_name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {filteredAccounts
                            .find((a) => a.id === selectedAccount)
                            ?.account_name?.charAt(0)
                            ?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {filteredAccounts.find((a) => a.id === selectedAccount)
                            ?.account_name || "User"}
                        </p>
                        <p className="text-xs text-gray-500">Now</p>
                      </div>
                    </div>

                    <div className="px-3 pb-3">
                      <div
                        className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words linkedin-preview-content prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedPost.content) }}
                      />
                    </div>

                    <div className="border-t border-gray-100 mt-2">
                      <div className="flex items-center justify-around py-1">
                        <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                          <ThumbsUp className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Like</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                          <MessageSquare className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Comment</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                          <Repeat2 className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Repost</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                          <Send className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Send</span>
                        </button>
                      </div>
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
        )
      }

      {
        showImagePreview && previewImageUrl && (
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
        )
      }
    </div >
  );
}