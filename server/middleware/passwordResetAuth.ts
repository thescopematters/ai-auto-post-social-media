import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import supabaseAdmin from "../config/database";
import { AuthenticationError } from "../utils/errors";

interface UserProfile {
  id: string;
  email: string;
  role: string;
}

export const passwordResetAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAdmin.auth.getSession();

    if (sessionError) {
      console.error("❌ Session check error:", sessionError);
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
        console.error("❌ User profile not found for session user");
      }
    }

    const token = req.body.resetToken || req.query.token;
    if (token && typeof token === "string") {
      try {
        const {
          data: { user },
          error: tokenError,
        } = await supabaseAdmin.auth.getUser(token);

        if (!tokenError && user) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, email, role")
            .eq("id", user.id)
            .single();

          if (profile) {
            const userProfile = profile as UserProfile;
            req.user = {
              id: userProfile.id,
              email: userProfile.email,
              role: userProfile.role,
            };
            return next();
          }
        } else {
          console.error("❌ Token validation failed:", tokenError);
        }
      } catch (tokenValidationError) {
        console.error("❌ Token validation error:", tokenValidationError);
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return next();
    }
    throw new AuthenticationError(
      "Reset link has expired or is invalid. Please request a new password reset email."
    );
  } catch (error) {
    console.error("Password reset auth error:", error);
    next(error);
  }
};
