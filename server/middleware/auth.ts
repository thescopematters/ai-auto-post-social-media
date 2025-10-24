import { Request, Response, NextFunction } from "express";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";
import supabaseAdmin from "../config/database";
import { createClient } from "@supabase/supabase-js";

const supabaseAuth = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthRequest extends Request {
  user?: TokenPayload & {
    id: string;
    role?: string;
  };
  workspaceId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("No token provided");
    }
    const token = authHeader.substring(7);
    try {
      const {
        data: { user },
        error,
      } = await supabaseAuth.auth.getUser(token);

      if (!error && user) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, email, role")
          .eq("id", user.id)
          .single();

        if (!profile) {
          throw new AuthenticationError("User profile not found");
        }

        req.user = {
          userId: user.id,
          id: user.id,
          email: user.email,
          role: profile.role,
        };
        next();
        return;
      } else {
        console.log('❌ Supabase token verification failed:', error?.message);
      }
    } catch (supabaseError) {
      console.log('❌ Supabase token verification exception:', supabaseError);
    }

    try {
      const decoded = verifyAccessToken(token);

      const { data: user, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("id", decoded.userId)
        .single();

      if (error || !user) {
        console.log('❌ User not found for custom token');
        throw new AuthenticationError("User not found");
      }

      req.user = {
        ...decoded,
        id: user.id,
        role: user.role,
      };

      next();
    } catch (customError) {
      console.log('❌ Custom token verification failed:', customError);
      throw customError;
    }

  } catch (error) {
    console.log('FINAL AUTH ERROR:', error);
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

    if (error || !membership) {
      const { data: workspace } = await supabaseAdmin
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .single();

      if (workspace && workspace.owner_id === req.user.id) {
        req.workspaceId = workspaceId;
        next();
        return;
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

      const { data: membership } = await supabaseAdmin
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", req.workspaceId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      const userRole = membership?.role || "viewer";

      if (!allowedRoles.includes(userRole)) {
        throw new AuthorizationError(
          `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
