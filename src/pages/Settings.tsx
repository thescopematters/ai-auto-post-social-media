import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Save,
  Linkedin,
  Twitter,
  KeyRound,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ChangePasswordModal } from "../pages/ChangePasswordModal";
import { authApi, socialAccountsApi } from "../lib/apiClient";

interface SocialAccount {
  id: string;
  workspace_id: string;
  platform: string;
  account_name: string;
  account_id: string;
  access_token: string;
  token_expires_at: string;
  is_active: boolean;
  connected_at: string;
  last_sync: string;
}

interface DisconnectConfirm {
  show: boolean;
  platform: string;
  accountName: string;
}

export function Settings() {
  const { profile, currentWorkspace, loading, signOut, updateUserProfile } =
    useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [companyName, setCompanyName] = useState(profile?.company_name || "");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [searchParams] = useSearchParams();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<DisconnectConfirm>(
    {
      show: false,
      platform: "",
      accountName: "",
    }
  );

  const backendUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3002/api/v1";

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !profile) {
      console.warn("User not authenticated, redirecting to signin");
      navigate("/signin");
    }
  }, [profile, loading, navigate]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }

    setSaving(true);

    try {
      const response = await authApi.updateProfile({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
      });

      if (response.success) {
        toast.success("Profile updated successfully!");
        // Fixed TypeScript error: Proper type checking and casting
        if (response.data && typeof response.data === 'object' && 'profile' in response.data && updateUserProfile) {
          updateUserProfile(response.data.profile as any);
        }
      } else {
        throw new Error(response.message || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("❌ Profile update error:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === "billing") {
      navigate("/subscription");
    } else {
      setActiveTab(tabId);
    }
  };

  const handleLinkedInConnect = async () => {
    setConnecting(true);
    try {
      if (!profile?.id) {
        toast.error("Please log in first");
        setConnecting(false);
        return;
      }

      window.location.href = `${backendUrl}/auth/linkedin?userId=${profile.id}`;
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error connecting to LinkedIn");
      setConnecting(false);
    }
  };

  const handleDisconnectAccount = (platform: string) => {
    const account = socialAccounts.find((acc) => acc.platform === platform);

    setDisconnectConfirm({
      show: true,
      platform,
      accountName: account?.account_name || platform,
    });
  };

  const confirmDisconnect = async () => {
    const { platform } = disconnectConfirm;

    try {
      const response = await socialAccountsApi.disconnectAccount(platform);

      if (response.success) {
        // Fetch updated accounts list
        fetchSocialAccounts();
        
        // ============================================
        // CRITICAL: Dispatch custom event to notify AppLayout
        // ============================================
        window.dispatchEvent(new CustomEvent('socialAccountDisconnected'));
        
        toast.success(
          `${
            platform.charAt(0).toUpperCase() + platform.slice(1)
          } account disconnected successfully`
        );
      } else {
        throw new Error(response.message || "Failed to disconnect account");
      }
    } catch (error: any) {
      console.error("Error disconnecting account:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Error disconnecting account. Please try again."
      );
    } finally {
      setDisconnectConfirm({ show: false, platform: "", accountName: "" });
    }
  };

  const cancelDisconnect = () => {
    setDisconnectConfirm({ show: false, platform: "", accountName: "" });
  };

  const fetchSocialAccounts = async () => {
    try {
      if (!currentWorkspace?.id) {
        console.warn("No workspace ID available");
        return;
      }

      const response = await socialAccountsApi.getAccounts(
        currentWorkspace.id
      );

      if (response.success && response.data) {
        // Fixed TypeScript error: Ensure response.data is treated as SocialAccount[]
        setSocialAccounts(response.data as SocialAccount[]);
      }
    } catch (error: any) {
      console.error("Error fetching social accounts:", error);
      setSocialAccounts([]);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setShowChangePasswordModal(false);
    await signOut();
    navigate("/signin");
  };

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const account = searchParams.get("account");

    if (success === "linkedin_connected") {
      toast.success("LinkedIn Connected Successfully!", {
        description: `Connected as: ${account}`,
      });
      fetchSocialAccounts();
      window.history.replaceState({}, "", "/settings");
    }

    if (error) {
      toast.error("LinkedIn Connection Failed", {
        description: error,
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSocialAccounts();
  }, [currentWorkspace?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  const isLinkedInConnected = socialAccounts.some(
    (account) => account.platform === "linkedin"
  );

  const getLinkedInAccount = () => {
    return socialAccounts.find((account) => account.platform === "linkedin");
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "connections", label: "Connections", icon: Linkedin },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "password", label: "Change Password", icon: KeyRound },
  ];

  return (
    <>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                        activeTab === tab.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {activeTab === "profile" && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Profile Information
                  </h2>
                  <div className="space-y-6 max-w-2xl">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profile?.email || ""}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "connections" && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Social Connections
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Linkedin className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">LinkedIn</p>
                          <p className="text-sm text-gray-500">
                            {isLinkedInConnected ? (
                              <>
                                Connected as:{" "}
                                {getLinkedInAccount()?.account_name}
                                <br />
                                <span className="text-green-600">
                                  Connected on:{" "}
                                  {new Date(
                                    getLinkedInAccount()?.connected_at || ""
                                  ).toLocaleDateString()}
                                </span>
                              </>
                            ) : (
                              "Not connected"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isLinkedInConnected ? (
                          <button
                            onClick={() => handleDisconnectAccount("linkedin")}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={handleLinkedInConnect}
                            disabled={connecting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                          >
                            {connecting ? "Connecting..." : "Connect"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-sky-100 rounded-lg">
                          <Twitter className="w-6 h-6 text-sky-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Twitter</p>
                          <p className="text-sm text-gray-500">Coming soon</p>
                        </div>
                      </div>
                      <button
                        disabled
                        className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "password" && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Change Password
                  </h2>
                  <div className="max-w-2xl">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-gray-700">
                        Keep your account secure by regularly updating your
                        password. After changing your password, you'll be signed
                        out and need to sign in again.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowChangePasswordModal(true)}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      <KeyRound className="w-5 h-5 mr-2" />
                      Change Password
                    </button>
                  </div>
                </div>
              )}

              {(activeTab === "notifications" || activeTab === "security") && (
                <div className="text-center py-12">
                  <p className="text-gray-500">This section is coming soon</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full transform transition-all">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Disconnect Account
                </h3>
              </div>
              <button
                onClick={cancelDisconnect}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to disconnect{" "}
                <span className="font-semibold text-gray-900">
                  {disconnectConfirm.accountName}
                </span>{" "}
                from{" "}
                {disconnectConfirm.platform.charAt(0).toUpperCase() +
                  disconnectConfirm.platform.slice(1)}
                ?
              </p>

              <div className="bg-red-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Important Note
                    </p>
                    <p className="text-sm text-yellow-700">
                      All your scheduled posts for this account won't be
                      published after disconnection.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
              <button
                onClick={cancelDisconnect}
                className="px-6 py-2.5 text-gray-700 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition duration-200 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  );
}