import { useState } from "react";
import { Linkedin, AlertCircle, CheckCircle } from "lucide-react";

interface SocialConnectionStatusProps {
  isSocialConnected: boolean;
  onConnect: () => void;
}

export function SocialConnectionStatus({
  isSocialConnected,
  onConnect,
}: SocialConnectionStatusProps) {
  const [showWarning, setShowWarning] = useState(false);

  const handleCancel = () => {
    setShowWarning(true);
  };

  const handleConnect = () => {
    onConnect();
  };

  if (isSocialConnected) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 mb-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">LinkedIn Connected</h3>
            <p className="text-gray-600 text-sm">Your account is ready for automated posting</p>
          </div>
        </div>
      </div>
    );
  }

  if (showWarning) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">
              Connect to Enable Scheduling
            </h3>
            <p className="text-gray-600 text-sm mb-3">
              Link your LinkedIn account to schedule posts directly from ContentAI
            </p>
            <button
              onClick={handleConnect}
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              Connect LinkedIn
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Connect Social Media</h3>
            <p className="text-gray-600 text-sm">Link LinkedIn to schedule posts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleConnect}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Linkedin className="w-4 h-4 mr-2" />
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
