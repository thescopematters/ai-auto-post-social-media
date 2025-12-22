import { X, Linkedin, Twitter, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

interface SocialConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SocialConnectionModal({
  isOpen,
  onClose,
}: SocialConnectionModalProps) {
  const { profile } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const backendUrl =
    import.meta.env.VITE_API_BASE_URL || "https://api.zeroeffortposts.com/api/v1";

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (selectedPlatform === "linkedin") {
      setConnecting(true);
      try {
        if (!profile?.id) {
          toast.error("Please log in first");
          setConnecting(false);
          return;
        }

        const authUrl = new URL(`${backendUrl}/auth/linkedin`);
        authUrl.searchParams.append("userId", profile.id);
        window.location.href = authUrl.toString();
      } catch (error: any) {
        console.error("Error:", error);
        toast.error("Error connecting to LinkedIn");
        setConnecting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-blue-800 p-3 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Connect Social Media</h2>
            <p className="text-blue-100 text-xs mt-0.5">Start scheduling</p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-600 text-sm mb-4">
            Connect your social media accounts to publish AI-generated content.
          </p>

          {/* Platform Options */}
          <div className="space-y-2 mb-4">
            {/* LinkedIn Option */}
            <div
              onClick={() => setSelectedPlatform("linkedin")}
              className={`flex items-center gap-2 p-3 border-2 rounded-lg transition cursor-pointer ${selectedPlatform === "linkedin"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                }`}
            >
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                <Linkedin className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">LinkedIn</p>
                <p className="text-xs text-gray-500">Professional posts</p>
              </div>
            </div>

            {/* Twitter Option (Disabled + Tooltip) */}
            <div className="relative flex items-center gap-2 p-3 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-70 cursor-not-allowed group">
              <div className="bg-sky-100 p-2 rounded-lg flex-shrink-0">
                <Twitter className="w-4 h-4 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Twitter/X</p>
                <p className="text-xs text-gray-500">Coming soon</p>
              </div>

              {/* Tooltip */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                Coming Soon
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <ul className="space-y-1 text-xs text-gray-600">
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span>{" "}
                Auto-schedule
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Track
                engagement
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Manage
                accounts
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
            >
              Later
            </button>
            <button
              onClick={handleConnect}
              disabled={selectedPlatform !== "linkedin" || connecting}
              className={`flex-1 px-3 py-2 rounded-lg transition font-medium text-sm flex items-center justify-center gap-1 ${selectedPlatform === "linkedin" && !connecting
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
            >
              {connecting ? "Connecting..." : "Connect"}
              {!connecting && <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
