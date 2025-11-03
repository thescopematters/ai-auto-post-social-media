import { Request, Response, NextFunction } from "express";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";
import supabaseAdmin from "../config/database";
import logger from "../config/logger";
import multer from "multer";

interface UserProfile {
  id: string;
  email: string;
  role: string;
}

interface WorkspaceMember {
  workspace_id: string;
  role: string;
}

interface Workspace {
  owner_id: string;
}

// Extended interface to support both JWT and Supabase session users
export interface AuthRequest extends Request {
  user?:
    | (TokenPayload & {
        id: string;
        role?: string;
      })
    | {
        id: string;
        email: string;
        role?: string;
      };
  workspaceId?: string;

  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] };
  file?: Express.Multer.File;
}

export const authenticateOptional = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);

      const { data: user, error: userError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("id", decoded.userId)
        .single();

      if (userError) {
        logger.warn("User profile not found:", userError);
        req.user = undefined;
        return next();
      }

      if (user) {
        const userProfile = user as UserProfile;
        req.user = {
          ...decoded,
          id: userProfile.id,
          role: userProfile.role,
        };
      }
    } catch (jwtError) {
      logger.warn("JWT verification failed:", jwtError);
      req.user = undefined;
    }

    next();
  } catch (error) {
    logger.error("Error in authenticateOptional:", error);
    next(error);
  }
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      try {
        const {
          data: { session },
          error,
        } = await supabaseAdmin.auth.getSession();

        if (error) {
          logger.warn("Supabase session check failed:", error);
          throw new AuthenticationError("No valid session found");
        }

        if (session && session.user) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, email, role")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            const userProfile = profile as UserProfile;
            req.user = {
              id: userProfile.id,
              email: userProfile.email,
              role: userProfile.role,
            };
            return next();
          } else {
            logger.warn("User profile not found for Supabase session user");
            throw new AuthenticationError("User profile not found");
          }
        } else {
          logger.warn("No Supabase session found");
          throw new AuthenticationError("No authentication provided");
        }
      } catch (sessionError) {
        logger.warn("Supabase session authentication failed:", sessionError);
        throw new AuthenticationError("No valid authentication found");
      }
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);

      const { data: user, error: userError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("id", decoded.userId)
        .single();

      if (userError) {
        throw new AuthenticationError("User not found");
      }

      if (user) {
        const userProfile = user as UserProfile;
        req.user = {
          ...decoded,
          id: userProfile.id,
          role: userProfile.role,
        };
        return next();
      }
    } catch (jwtError) {
      logger.error("JWT verification failed:", jwtError);
      throw new AuthenticationError("Invalid token");
    }

    throw new AuthenticationError("User not authenticated");
  } catch (error) {
    next(error);
  }
};

export const requireWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId =
      req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;

    if (!workspaceId) {
      throw new AuthorizationError("Workspace ID required");
    }

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const { data: membership, error } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      logger.warn("Workspace membership check error:", error);
    }

    if (!membership) {
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .single();

      if (workspaceError) {
        throw new AuthorizationError("Workspace not found");
      }

      if (workspace) {
        const workspaceData = workspace as Workspace;
        if (workspaceData.owner_id === req.user.id) {
          req.workspaceId = workspaceId;
          return next();
        }
      }

      throw new AuthorizationError("Access to workspace denied");
    }

    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError("User not authenticated");
      }

      if (!req.workspaceId) {
        throw new AuthorizationError("Workspace context required");
      }

      const { data: membership, error } = await supabaseAdmin
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", req.workspaceId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (error) {
        logger.warn("Role check error:", error);
      }

      let userRole = "viewer";

      if (membership) {
        const memberData = membership as WorkspaceMember;
        userRole = memberData.role;
      } else {
        const { data: workspace } = await supabaseAdmin
          .from("workspaces")
          .select("owner_id")
          .eq("id", req.workspaceId)
          .single();

        if (workspace) {
          const workspaceData = workspace as Workspace;
          if (workspaceData.owner_id === req.user.id) {
            userRole = "admin";
          }
        }
      }

      if (!allowedRoles.includes(userRole)) {
        throw new AuthorizationError(
          `Insufficient permissions. Required roles: ${allowedRoles.join(
            ", "
          )}. Your role: ${userRole}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const isTokenPayloadUser = (
  user: any
): user is TokenPayload & { id: string; role?: string } => {
  return user && "userId" in user;
};

export const isSupabaseSessionUser = (
  user: any
): user is { id: string; email: string; role?: string } => {
  return user && "id" in user && "email" in user && !("userId" in user);
};

export const getUserId = (user: AuthRequest["user"]): string => {
  if (!user) throw new AuthenticationError("User not authenticated");
  return isTokenPayloadUser(user) ? user.userId : user.id;
};

export const getUserEmail = (user: AuthRequest["user"]): string => {
  if (!user) throw new AuthenticationError("User not authenticated");
  return isTokenPayloadUser(user) ? user.email : user.email;
};
