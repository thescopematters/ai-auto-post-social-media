import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  Crown
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { SocialConnectionModal } from '../pages/SocialConnectionModal';
import { socialAccountsApi, workspaceApi } from '../lib/apiClient';

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

interface UsageLimitDetail {
  planType: string;
  [key: string]: any;
}

interface UploadLimitsResponse {
  documentUpload: UsageLimitDetail;
  aiGeneration: UsageLimitDetail;
  weeklyPosting: UsageLimitDetail;
  linkedinRecommendation: { [key: string]: any; };
}

export function AppLayout() {
  const { profile, currentWorkspace, workspaces, setCurrentWorkspace, signOut } = useAuth();

  const [planType, setPlanType] = useState<string>("Free");
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [isSocialConnected, setIsSocialConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Fetch plan type
  useEffect(() => {
    const fetchPlan = async () => {
      if (!currentWorkspace) {
        setIsLoadingPlan(false);
        return;
      }

      setIsLoadingPlan(true);

      try {
        const res = await workspaceApi.getLimits(currentWorkspace.id);
        const data = res.data as UploadLimitsResponse;
        const plan = data?.aiGeneration?.planType || "Free";
        setPlanType(plan);
      } catch (err) {
        console.error("Error loading plan", err);
        setPlanType("Free");
      } finally {
        setIsLoadingPlan(false);
      }
    };

    fetchPlan();
  }, [currentWorkspace]);

  // Check social connection - now using useCallback for reusability
  const checkSocialConnection = useCallback(async () => {
    if (!currentWorkspace) {
      setIsCheckingConnection(false);
      return;
    }

    try {
      const response = await socialAccountsApi.getAccounts(currentWorkspace.id);

      if (response.success && response.data) {
        const accounts = response.data as SocialAccount[];
        const linkedInConnected = accounts.some(
          (account: SocialAccount) => account.platform === 'linkedin' && account.is_active
        );
        setIsSocialConnected(linkedInConnected);
      } else {
        setIsSocialConnected(false);
      }
    } catch (error) {
      console.error('Error checking social connection:', error);
      setIsSocialConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    checkSocialConnection();
  }, [checkSocialConnection]);

  // ============================================
  // NEW: Listen for custom event when account is disconnected
  // ============================================
  useEffect(() => {
    const handleAccountDisconnected = () => {
      console.log('Social account disconnected - refreshing connection status');
      checkSocialConnection();

      // If user is on a restricted route, show the modal
      const restrictedRoutes = ['/documents', '/generator', '/schedule'];
      if (restrictedRoutes.includes(location.pathname)) {
        setShowSocialModal(true);
      }
    };

    // Listen for the custom event
    window.addEventListener('socialAccountDisconnected', handleAccountDisconnected);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('socialAccountDisconnected', handleAccountDisconnected);
    };
  }, [checkSocialConnection, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    const restrictedRoutes = ['/documents', '/generator', '/schedule'];

    if (showSocialModal && !restrictedRoutes.includes(path)) {
      setShowSocialModal(false);
      setSidebarOpen(false);
      return;
    }

    if (restrictedRoutes.includes(path)) {
      if (!isSocialConnected && !isCheckingConnection) {
        e.preventDefault();
        setShowSocialModal(true);
        setSidebarOpen(false);
        return;
      }
    }

    setSidebarOpen(false);
  };

  const formatPlanType = (plan: string) => {
    if (!plan) return 'N/A';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Documents', path: '/documents' },
    { icon: Sparkles, label: 'Content Generator', path: '/generator' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Crown, label: 'Subscription', path: '/subscription' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <>
      <SocialConnectionModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
      />

      <div className="min-h-screen bg-gray-50 flex">
        <aside
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white 
            border-r border-gray-200 transition-transform duration-300 ease-in-out`}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="w-full flex justify-center">
                  <Link to="/dashboard" className="flex flex-col items-center gap-2">
                    <img src="/logo.png" alt="ContentAI" className="h-20 w-auto" />

                    <div className="flex flex-col items-center">
                      <p className="text-xs text-gray-500 capitalize leading-none">
                        {isLoadingPlan ? 'Loading...' : `${formatPlanType(planType)} Plan`}
                      </p>
                    </div>
                  </Link>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {currentWorkspace && (
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: currentWorkspace.brand_color || '#3b82f6' }}
                    >
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{currentWorkspace.name}</p>
                      <p className="text-xs text-gray-500">Workspace</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {workspaceDropdownOpen && workspaces.length > 1 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg space-y-1">
                    {workspaces
                      .filter(w => w.id !== currentWorkspace.id)
                      .map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => {
                            setCurrentWorkspace(workspace);
                            setWorkspaceDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded hover:bg-white transition text-left"
                        >
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: workspace.brand_color || '#3b82f6' }}
                          >
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm text-gray-700">{workspace.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                  {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link to="/dashboard" className="flex items-center space-x-2">
                <img src="/logo.png" alt="ContentAI" className="h-8 w-auto" />
              </Link>
              <div className="w-6"></div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </>
  );
}