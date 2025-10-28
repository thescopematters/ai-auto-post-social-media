import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { authApi, workspaceApi } from "../lib/apiClient";

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

const initializedRef = useRef(false);

useEffect(() => {
  const initAuth = async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const token = localStorage.getItem("accessToken");

    if (token) {
      try {
        await loadUserData();
      } catch (error) {
        console.error("Error loading user data:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
        setProfile(null);
      }
    } else {
      console.warn("No token found, user is not logged in");
    }

    setLoading(false);
  };

  initAuth();
}, []);

  const loadUserData = async () => {
    try {
      const response = await authApi.getCurrentUser();

      if (response.success && response.data) {
        const userData = response.data as any;

        setUser({
          id: userData.id,
          email: userData.email,
          fullName: userData.fullName || userData.full_name,
          role: userData.role,
        });

        setProfile(userData);

        const workspacesResponse = await workspaceApi.getAll();

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

            setCurrentWorkspaceState(workspace);
          } else {
            console.warn("No workspaces found for user");
            setWorkspaces([]);
            setCurrentWorkspaceState(null);
          }
        }
      } else {
        console.error("Failed to load user data:", response.error);
        throw new Error(response.error || "Failed to load user data");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await authApi.register(email, password, fullName);

      if (response.success && response.data) {
        const {
          accessToken,
          refreshToken,
          user: userData,
        } = response.data as any;

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
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);

      if (response.success && response.data) {
        const {
          accessToken,
          refreshToken,
          user: userData,
        } = response.data as any;

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

      return { error: new Error(response.error || "Login failed") };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentWorkspaceId");
      setUser(null);
      setProfile(null);
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
    }
  };

  const setCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem("currentWorkspaceId", workspace.id);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData();
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
