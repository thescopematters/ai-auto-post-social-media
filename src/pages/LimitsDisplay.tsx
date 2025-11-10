import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Info, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

interface WorkspaceLimits {
  documentUpload: {
    canUpload: boolean;
    currentCount: number;
    limit: number;
    remaining: number;
    planType: string;
  };
  aiGeneration: {
    canGenerate: boolean;
    currentUsage: number;
    limit: number;
    remaining: number;
    planType: string;
  };
  weeklyPosting: {
    canPost: boolean;
    postsThisWeek: number;
    limit: number;
    remaining: number;
    nextResetDate: string;
    planType: string;
  };
  linkedinRecommendation: {
    note: string;
    idealFrequency: string;
  };
}

export function LimitsDisplay() {
  const { currentWorkspace } = useAuth();
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLimits();
  }, [currentWorkspace]);

  const loadLimits = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/workspaces/${
          currentWorkspace.id
        }/limits`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setLimits(data.data);
      }
    } catch (error) {
      console.error("Error loading limits:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!limits) return null;

  const isPro = limits.aiGeneration.planType === "pro";

  return (
    <div className="space-y-4">
      {/* Usage Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Usage Summary</h3>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isPro
                ? "bg-purple-100 text-purple-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {isPro ? "Pro Plan" : "Free Plan"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Documents */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Documents
              </span>
              {limits.documentUpload.canUpload ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {limits.documentUpload.currentCount} /{" "}
              {limits.documentUpload.limit}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {limits.documentUpload.remaining} remaining
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  limits.documentUpload.remaining > 0
                    ? "bg-blue-600"
                    : "bg-red-600"
                }`}
                style={{
                  width: `${
                    (limits.documentUpload.currentCount /
                      limits.documentUpload.limit) *
                    100
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* AI Generations */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                AI Generations
              </span>
              {limits.aiGeneration.canGenerate ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {limits.aiGeneration.currentUsage} / {limits.aiGeneration.limit}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {limits.aiGeneration.remaining} remaining
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  limits.aiGeneration.remaining > 0
                    ? "bg-purple-600"
                    : "bg-red-600"
                }`}
                style={{
                  width: `${
                    (limits.aiGeneration.currentUsage /
                      limits.aiGeneration.limit) *
                    100
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* Weekly Publishing */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Weekly Posts
              </span>
              {limits.weeklyPosting.canPost ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isPro
                ? "∞"
                : `${limits.weeklyPosting.postsThisWeek} / ${limits.weeklyPosting.limit}`}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {isPro
                ? "Unlimited weekly posts"
                : `${limits.weeklyPosting.remaining} posts this week`}
            </div>
            {!isPro && !limits.weeklyPosting.canPost && (
              <div className="text-xs text-red-600 mt-1">
                Resets on{" "}
                {new Date(
                  limits.weeklyPosting.nextResetDate
                ).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Daily Publishing - REMOVE THIS OR FIX */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Plan Type
              </span>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isPro ? "Pro" : "Free"}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {isPro ? "All features" : "Basic features"}
            </div>
          </div>
        </div>

        {/* Upgrade Banner for Free Users */}
        {!isPro && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Upgrade to Pro
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Get 20 documents, 100 AI generations, and unlimited weekly posts
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn Best Practices */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              LinkedIn Best Practices
            </h4>
            <p className="text-sm text-gray-700 mb-3">
              {limits.linkedinRecommendation.note}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Ideal Frequency:</span>
                <span className="px-2 py-1 bg-white rounded text-blue-700 font-medium">
                  {limits.linkedinRecommendation.idealFrequency}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}