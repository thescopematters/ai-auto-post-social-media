import { X, Linkedin, Twitter, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SocialConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SocialConnectionModal({
  isOpen,
  onClose,
}: SocialConnectionModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleConnect = () => {
    navigate("/settings?tab=connections");
    onClose();
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
            <div className="flex items-center gap-2 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer">
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                <Linkedin className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">LinkedIn</p>
                <p className="text-xs text-gray-500">Professional posts</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 border-2 border-gray-200 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition cursor-pointer">
              <div className="bg-sky-100 p-2 rounded-lg flex-shrink-0">
                <Twitter className="w-4 h-4 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Twitter/X</p>
                <p className="text-xs text-gray-500">Reach audience</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <ul className="space-y-1 text-xs text-gray-600">
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Auto-schedule
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Track engagement
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Manage accounts
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
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center justify-center gap-1"
            >
              Connect
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}