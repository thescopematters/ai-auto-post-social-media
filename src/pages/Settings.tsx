import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useSearchParams } from "react-router-dom";
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
  const { profile, currentWorkspace, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [companyName, setCompanyName] = useState(profile?.company_name || "");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [searchParams] = useSearchParams();

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    await supabase
      .from("profiles")
      .update({ full_name: fullName, company_name: companyName } as any)
      .eq("id", profile.id);

    await refreshProfile();
    setSaving(false);
  };

  const handleLinkedInConnect = async () => {
    setConnecting(true);
    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";

      // Get the current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please sign in to connect LinkedIn");
        return;
      }

      // Pass token as query parameter for the backend to use
      const linkedInUrl = `${backendUrl}/auth/linkedin?token=${encodeURIComponent(
        session.access_token
      )}`;
      window.location.href = linkedInUrl;
    } catch (error) {
      console.error("❌ Error initiating LinkedIn OAuth:", error);
      alert("Error connecting to LinkedIn. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectAccount = async (platform: string) => {
    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";
      const response = await fetch(`${backendUrl}/auth/accounts/${platform}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            (
              await supabase.auth.getSession()
            ).data.session?.access_token
          }`,
        },
      });

      if (response.ok) {
        fetchSocialAccounts();
        alert(`${platform} account disconnected successfully`);
      } else {
        throw new Error("Failed to disconnect account");
      }
    } catch (error) {
      console.error("Error disconnecting account:", error);
      alert("Error disconnecting account. Please try again.");
    }
  };

  const fetchSocialAccounts = async () => {
    try {
      const backendUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api/v1";
      const response = await fetch(`${backendUrl}/auth/accounts`, {
        headers: {
          Authorization: `Bearer ${
            (
              await supabase.auth.getSession()
            ).data.session?.access_token
          }`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSocialAccounts(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching social accounts:", error);
    }
  };

  // Check if LinkedIn is connected
  const isLinkedInConnected = socialAccounts.some(
    (account) => account.platform === "linkedin"
  );

  const getLinkedInAccount = () => {
    return socialAccounts.find((account) => account.platform === "linkedin");
  };

  // Handle OAuth callback results
  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const account = searchParams.get("account");

    if (success === "linkedin_connected") {
      alert(`LinkedIn connected successfully! Connected as: ${account}`);
      fetchSocialAccounts();
      // Clean up URL
      window.history.replaceState({}, "", "/settings");
    }

    if (error) {
      alert(`LinkedIn connection failed: ${error}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  // Fetch social accounts on component mount
  useEffect(() => {
    fetchSocialAccounts();
  }, []);

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

            {activeTab === "workspace" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Workspace Settings
                </h2>
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={currentWorkspace?.name || ""}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand Color
                    </label>
                    <input
                      type="color"
                      value={currentWorkspace?.brand_color || "#3b82f6"}
                      disabled
                      className="w-20 h-10 border border-gray-300 rounded-lg cursor-pointer"
                    />
                  </div>
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

            {(activeTab === "notifications" ||
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
