// @ts-nocheck
import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import supabaseAdmin from "../config/database";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";
import {
  AuthRequest,
  isTokenPayloadUser,
  getUserId,
  getUserEmail,
} from "../middleware/auth";

export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, fullName, role } = req.body;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new ValidationError("Please provide a valid email address");
    }

    // Password validation
    if (!password || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long");
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    if (!hasUpperCase) {
      throw new ValidationError(
        "Password must contain at least one uppercase letter"
      );
    }
    if (!hasLowerCase) {
      throw new ValidationError(
        "Password must contain at least one lowercase letter"
      );
    }
    if (!hasNumber) {
      throw new ValidationError("Password must contain at least one number");
    }
    if (!hasSpecialChar) {
      throw new ValidationError(
        "Password must contain at least one special character"
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      console.error("Supabase createUser failed with error:", authError);
      throw new AuthenticationError("Failed to create user account");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: role || "user",
      } as any);

    if (profileError) {
      logger.error("Profile creation error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new AuthenticationError("Failed to create user profile");
    }

    const { data: planData, error: planError } = await supabaseAdmin
      .from("users_plans")
      .insert({
        user_id: authData.user.id,
        subs_plan_id: "576c63d2-e9b3-4a78-8260-caf510b40c94", // Free plan ID
        status: "active",
        start_date: new Date().toISOString(),
      })
      .select();

    if (planError) {
      console.error("❌ Failed to assign free plan:", planError);
    } else {
      console.log("users_plans entry created successfully");
    }

    // Create a default workspace for the user (static brand color, no logo)
    const workspaceName =
      (fullName && fullName.trim()) || "My Workspace";

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name: workspaceName,
        owner_id: authData.user.id,
        brand_color: "#3B82F6",
        logo_url: null,
      } as any)
      .select()
      .single();

    if (workspaceError || !workspace) {
      logger.error("Workspace creation error during signup:", workspaceError);
      throw new AuthenticationError("Failed to create default workspace");
    }

    const { error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: authData.user.id,
        role: "admin",
      });

    if (memberError) {
      logger.error("Workspace member creation error during signup:", memberError);
      throw new AuthenticationError("Failed to add user to workspace");
    }

    logger.info(`Creating subscription for workspace: ${workspace.id}`);
    const { error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        workspace_id: workspace.id,
        tier: "free",
        status: "active",
        usage_limits: {
          posts_per_month: 10,
          ai_generations: 50,
          workspaces: 1,
        },
      });

    if (subscriptionError) {
      logger.error("Subscription creation error during signup:", {
        error: subscriptionError,
        workspaceId: workspace.id,
        userId: authData.user.id
      });
      throw new AuthenticationError("Failed to create workspace subscription");
    }

    const { error: configError } = await supabaseAdmin
      .from("ai_agent_configs")
      .insert({
        workspace_id: workspace.id,
        name: "Default Agent",
        tone: "professional",
        style: {},
        intent: "engagement",
        hashtag_strategy: {},
        posting_frequency: {},
        platform_settings: {},
        is_default: true,
      });

    if (configError) {
      logger.error("AI config creation error during signup:", configError);
      throw new AuthenticationError("Failed to create workspace AI config");
    }

    // Create initial usage limits record to prevent race conditions during first limit check
    const initialUsage = {
      total_ai_generations: 0,
      ai_daily_count: 0,
      ai_last_reset_date: new Date().toISOString().split("T")[0],
      daily_post_count: 0,
      post_last_reset_date: new Date().toISOString().split("T")[0],
      weekly_posts_count: 0,
      week_start_date: null,
      next_reset_date: null,
      total_documents: 0,
      last_post_time: null
    };

    const { error: usageError } = await supabaseAdmin
      .from("user_usage_limits")
      .insert({
        user_id: authData.user.id,
        usage_data: initialUsage
      });

    if (usageError) {
      logger.error("Usage limits creation error during signup:", usageError);
      // Not throwing here as getOrCreateUsageRecord fallback still exists
    }

    const accessToken = generateAccessToken({
      userId: authData.user.id,
      email,
    });

    const refreshToken = generateRefreshToken({
      userId: authData.user.id,
      email,
    });

    successResponse(
      res,
      {
        user: {
          id: authData.user.id,
          email,
          fullName,
          role: role || "user",
        },
        workspace,
        accessToken,
        refreshToken,
      },
      "Registration successful",
      201
    );
  } catch (error) {
    console.log("❌ Registration error:", error);
    next(error);
  }
};

export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      throw new AuthenticationError("User profile not found");
    }

    const accessToken = generateAccessToken({
      userId: (profile as any as any).id,
      email: (profile as any as any).email,
    });

    const refreshToken = generateRefreshToken({
      userId: (profile as any as any).id,
      email: (profile as any as any).email,
    });

    successResponse(
      res,
      {
        user: {
          id: (profile as any as any).id,
          email: (profile as any as any).email,
          fullName: (profile as any as any).full_name,
          role: (profile as any as any).role,
        },
        accessToken,
        refreshToken,
      },
      "Login successful"
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new ValidationError("Refresh token is required");
    }

    const decoded = verifyRefreshToken(token);

    const { data: user } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", decoded.userId)
      .single();

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    const accessToken = generateAccessToken({
      userId: (user as any as any).id,
      email: (user as any as any).email,
    });

    const newRefreshToken = generateRefreshToken({
      userId: (user as any as any).id,
      email: (user as any as any).email,
    });

    successResponse(
      res,
      {
        accessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, companyName } = req.body;

    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        company_name: companyName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.user.id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Profile update error:", updateError);
      throw new AuthenticationError("Failed to update profile");
    }

    successResponse(
      res,
      {
        profile: updatedProfile,
      },
      "Profile updated successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      logger.info(`User logged out: ${req.user.email}`);
    }

    successResponse(res, null, "Logout successful");
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (!profile) {
      throw new AuthenticationError("User profile not found");
    }

    successResponse(res, profile, "User profile retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError("User not authenticated");
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (error || !data.user) {
      throw new AuthenticationError("Current password is incorrect");
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
        password: newPassword,
      });

    if (updateError) {
      throw new AuthenticationError("Failed to update password");
    }

    successResponse(res, null, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      throw new ValidationError("Please provide a valid email address");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectTo = `${frontendUrl}/reset-password`;

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: redirectTo,
      }
    );

    if (error) {
      logger.error("❌ Password reset email error:", error);

      if (error.status === 429) {
        throw new AuthenticationError(
          "Too many reset attempts. Please wait 60 minutes before requesting another reset email."
        );
      } else if (error.message.includes("email_not_confirmed")) {
        logger.info(`Email not confirmed for: ${email}`);
      }

      throw new AuthenticationError(
        "A reset link has been sent. Please check your inbox and spam folder."
      );
    }

    successResponse(
      res,
      {
        emailSent: true,
        message:
          "A reset link has been sent. Check your inbox and spam folder.",
      },
      "Password reset email sent successfully"
    );
  } catch (error: any) {
    logger.error("Forgot password error:", error);
    next(error);
  }
};

export const resetPassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { newPassword } = req.body;

    if (!req.user) {
      console.error("❌ No user in request");
      throw new AuthenticationError(
        "User not authenticated. Please use the reset link from your email."
      );
    }

    const userId = req.user.id;
    const userEmail = req.user.email;

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) {
      console.error("❌ Password reset error:", updateError);

      if (updateError.status === 429) {
        throw new AuthenticationError(
          "Too many password reset attempts. Please wait a few minutes."
        );
      }

      throw new AuthenticationError(
        `Failed to reset password: ${updateError.message}`
      );
    }

    try {
      await supabaseAdmin.auth.admin.signOut(userId);
    } catch (signOutError) {
      console.warn(
        "Could not sign out user after password reset:",
        signOutError
      );
    }

    successResponse(
      res,
      {
        passwordChanged: true,
        message: "Password reset successfully",
      },
      "Password reset successfully"
    );
  } catch (error) {
    console.error("Reset password error:", error);
    next(error);
  }
};

export const validateResetToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      throw new ValidationError("Reset token is required");
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabaseAdmin.auth.getUser(token);

      if (userError) {
        console.log(
          "❌ Direct token validation failed, trying session approach..."
        );

        const {
          data: { session },
          error: sessionError,
        } = await supabaseAdmin.auth.getSession();

        if (sessionError || !session) {
          console.error("❌ Session validation also failed");
          throw new AuthenticationError(
            "Invalid or expired reset token. Please request a new reset link."
          );
        }

        const sessionUser = session.user;

        // Get user profile
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", sessionUser.id)
          .single();

        successResponse(
          res,
          {
            user: {
              id: sessionUser.id,
              email: sessionUser.email!,
              fullName: profile?.full_name || "",
            },
            valid: true,
          },
          "Reset token is valid"
        );
        return;
      }

      if (!user) {
        throw new AuthenticationError("Invalid reset token");
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", user.id)
        .single();

      successResponse(
        res,
        {
          user: {
            id: user.id,
            email: user.email!,
            fullName: profile?.full_name || "",
          },
          valid: true,
        },
        "Reset token is valid"
      );
    } catch (authError) {
      console.error("❌ Auth validation error:", authError);
      throw new AuthenticationError(
        "Invalid or expired reset token. Please request a new reset link."
      );
    }
  } catch (error) {
    console.error("Token validation error:", error);
    next(error);
  }
};