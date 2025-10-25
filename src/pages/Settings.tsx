import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Save,
  Linkedin,
  Twitter,
} from "lucide-react";
import logger from "../utils/logger";

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

export function Settings() {
  const { profile, currentWorkspace, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [companyName, setCompanyName] = useState(profile?.company_name || "");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    logger.info("=== Settings Component Mounted ===");
    logger.info("Current auth state:", {
      hasProfile: !!profile,
      profileId: profile?.id,
      profileEmail: profile?.email,
      hasWorkspace: !!currentWorkspace,
      loading: loading,
    });

    if (loading) {
      logger.info("Still loading auth data...");
    }

    if (!loading && !profile) {
      logger.warn("User not authenticated, redirecting to signin");
      navigate("/signin");
    }
  }, [profile, loading, navigate]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    setSaving(false);
  };

  const handleLinkedInConnect = async () => {
    setConnecting(true);
    try {
      if (!profile?.id) {
        alert("Please log in first");
        setConnecting(false);
        return;
      }

      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";

      window.location.href = `${backendUrl}/auth/linkedin?userId=${profile.id}`;
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error connecting to LinkedIn");
      setConnecting(false);
    }
  };

  const handleDisconnectAccount = async (platform: string) => {
    logger.info("Disconnecting account:", { platform });
    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";

      const token = localStorage.getItem("accessToken");

      if (!token) {
        alert("Please sign in to disconnect account");
        return;
      }

      const response = await fetch(`${backendUrl}/auth/accounts/${platform}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchSocialAccounts();
        alert(`✅ ${platform} account disconnected successfully`);
        logger.info("Account disconnected:", { platform });
      } else {
        throw new Error("Failed to disconnect account");
      }
    } catch (error) {
      logger.error("Error disconnecting account:", error);
      alert("Error disconnecting account. Please try again.");
    }
  };

  const fetchSocialAccounts = async () => {
    logger.info("Fetching social accounts...");

    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";
      const token = localStorage.getItem("accessToken");

      if (!token) {
        logger.warn("No token for fetching social accounts");
        return;
      }

      const response = await fetch(
        `${backendUrl}/workspaces/${currentWorkspace?.id}/social-accounts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSocialAccounts(data.data);
          logger.info("Social accounts fetched:", {
            count: data.data?.length || 0,
          });
        }
      } else {
        logger.error("Failed to fetch social accounts:", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Error fetching social accounts:", error);
      setSocialAccounts([]);
    }
  };

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const account = searchParams.get("account");

    if (success === "linkedin_connected") {
      logger.info("LinkedIn connection successful:", { account });
      alert(`✅ LinkedIn connected successfully! Connected as: ${account}`);
      fetchSocialAccounts();
      window.history.replaceState({}, "", "/settings");
    }

    if (error) {
      logger.error("LinkedIn connection failed:", { error });
      alert(`❌ LinkedIn connection failed: ${error}`);
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
    { id: "workspace", label: "Workspace", icon: Building2 },
    { id: "connections", label: "Connections", icon: Linkedin },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
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
                    onClick={() => setActiveTab(tab.id)}
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
                              Connected as: {getLinkedInAccount()?.account_name}
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

            {(activeTab === "workspace" ||
              activeTab === "notifications" ||
              activeTab === "security" ||
              activeTab === "billing") && (
              <div className="text-center py-12">
                <p className="text-gray-500">This section is coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
