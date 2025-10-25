import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authApi, workspaceApi } from "../lib/apiClient";
import logger from "../utils/logger";

interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  brand_color: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] =
    useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      logger.info("=== AuthContext Initialization ===");

      const token = localStorage.getItem("accessToken");
      logger.info("Checking for stored token:", {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + "..." : "none",
      });

      if (token) {
        try {
          logger.info("Token found, loading user data...");
          await loadUserData();
          logger.info("User data loaded successfully");
        } catch (error) {
          logger.error("Failed to load user data:", error);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setUser(null);
          setProfile(null);
        }
      } else {
        logger.info("No token found, user is not logged in");
      }

      setLoading(false);
      logger.info("=== AuthContext Initialization Complete ===");
    };

    initAuth();
  }, []);

  const loadUserData = async () => {
    try {
      logger.info("Loading user data from API...");

      const response = await authApi.getCurrentUser();

      logger.info("getCurrentUser response:", {
        success: response.success,
        hasData: !!response.data,
        error: response.error,
      });

      if (response.success && response.data) {
        const userData = response.data as any;

        logger.info("User profile received:", {
          id: userData.id,
          email: userData.email,
          role: userData.role,
        });

        setUser({
          id: userData.id,
          email: userData.email,
          fullName: userData.fullName || userData.full_name,
          role: userData.role,
        });

        setProfile(userData);

        logger.info("Fetching workspaces...");
        const workspacesResponse = await workspaceApi.getAll();

        logger.info("Workspaces response:", {
          success: workspacesResponse.success,
          count: Array.isArray(workspacesResponse.data)
            ? workspacesResponse.data.length
            : 0,
        });

        if (workspacesResponse.success && workspacesResponse.data) {
          const allWorkspaces = workspacesResponse.data as Workspace[];

          if (allWorkspaces.length > 0) {
            allWorkspaces.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            setWorkspaces(allWorkspaces);

            const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
            const workspace = savedWorkspaceId
              ? allWorkspaces.find((w) => w.id === savedWorkspaceId) ||
                allWorkspaces[0]
              : allWorkspaces[0];

            logger.info("Current workspace set:", {
              id: workspace.id,
              name: workspace.name,
            });

            setCurrentWorkspaceState(workspace);
          } else {
            logger.warn("No workspaces found for user");
            setWorkspaces([]);
            setCurrentWorkspaceState(null);
          }
        }
      } else {
        logger.error("Failed to load user data:", response.error);
        throw new Error(response.error || "Failed to load user data");
      }
    } catch (error) {
      logger.error("Error loading user data:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      logger.info("Signing up user:", { email, fullName });

      const response = await authApi.register(email, password, fullName);

      logger.info("Registration response:", {
        success: response.success,
        error: response.error,
      });

      if (response.success && response.data) {
        const {
          accessToken,
          refreshToken,
          user: userData,
        } = response.data as any;

        logger.info("Registration successful, saving tokens");

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        setUser({
          id: userData.id,
          email: userData.email,
          fullName: userData.fullName,
          role: userData.role,
        });

        await loadUserData();

        return { error: null };
      }

      return { error: new Error(response.error || "Registration failed") };
    } catch (error) {
      logger.error("Sign up error:", error);
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      logger.info("Signing in user:", { email });

      const response = await authApi.login(email, password);

      logger.info("Login response:", {
        success: response.success,
        error: response.error,
      });

      if (response.success && response.data) {
        const {
          accessToken,
          refreshToken,
          user: userData,
        } = response.data as any;

        logger.info("Login successful, saving tokens");

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        setUser({
          id: userData.id,
          email: userData.email,
          fullName: userData.fullName,
          role: userData.role,
        });

        await loadUserData();

        logger.info("User data loaded after login");

        return { error: null };
      }

      return { error: new Error(response.error || "Login failed") };
    } catch (error) {
      logger.error("Sign in error:", error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      logger.info("Signing out user...");

      await authApi.logout();
    } catch (error) {
      logger.error("Logout error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentWorkspaceId");
      setUser(null);
      setProfile(null);
      setWorkspaces([]);
      setCurrentWorkspaceState(null);

      logger.info("User logged out and state cleared");
    }
  };

  const setCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem("currentWorkspaceId", workspace.id);
    logger.info("Workspace changed:", {
      id: workspace.id,
      name: workspace.name,
    });
  };

  const refreshProfile = async () => {
    if (user) {
      logger.info("Refreshing profile...");
      await loadUserData();
      logger.info("Profile refreshed");
    }
  };

  const isAuthenticated = !!user && !!profile;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        workspaces,
        currentWorkspace,
        loading,
        isAuthenticated,
        signUp,
        signIn,
        signOut,
        setCurrentWorkspace,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
