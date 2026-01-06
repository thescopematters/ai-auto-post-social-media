// @ts-nocheck
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";
import {
  getUserPlanLimits,
  checkDocumentUploadLimit,
  checkAIGenerationLimit,
  checkDailyPostLimit, // ✅ ADDED
  checkWeeklyPostLimit,
} from "../utils/limitCheck";

export const getAllWorkspaces = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthorizationError("User not authenticated");
    }

    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          owner_id,
          brand_color,
          logo_url,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", req.user.id);

    if (error) {
      logger.error("Error fetching workspaces:", error);
      throw new Error("Failed to fetch workspaces");
    }

    // Transform the data to match expected format
    const workspaces = (data || []).map((item: any) => ({
      ...item.workspaces,
      role: item.role
    }));

    successResponse(res, workspaces, "Workspaces retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Workspace not found");
    }

    successResponse(res, data, "Workspace retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const createWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthorizationError("User not authenticated");
    }

    const { name, brandColor, logoUrl } = req.body;

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name,
        owner_id: req.user.id,
        brand_color: brandColor || "#3B82F6",
        logo_url: logoUrl,
      } as any)
      .select()
      .single();

    if (workspaceError || !workspace) {
      logger.error("Workspace creation error:", workspaceError);
      throw new Error("Failed to create workspace");
    }

    const { error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: req.user.id,
        role: "admin",
      });

    if (memberError) {
      logger.error("Workspace member creation error:", memberError);
    }

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
      logger.error("Subscription creation error:", subscriptionError);
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
      logger.error("AI config creation error:", configError);
    }

    successResponse(res, workspace, "Workspace created successfully", 201);
  } catch (error) {
    next(error);
  }
};

export const updateWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { name, brandColor, logoUrl } = req.body;

    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .update({
        name,
        brand_color: brandColor,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", workspaceId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError("Workspace not found");
    }

    successResponse(res, data, "Workspace updated successfully");
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const { error } = await supabaseAdmin
      .from("workspaces")
      .delete()
      .eq("id", workspaceId);

    if (error) {
      throw new NotFoundError("Workspace not found");
    }

    successResponse(res, null, "Workspace deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceMembers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .select("*, profiles(id, email, full_name, avatar_url)")
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error("Failed to fetch workspace members");
    }

    successResponse(
      res,
      data || [],
      "Workspace members retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const addWorkspaceMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { userId, role } = req.body;

    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: role || "viewer",
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error("Failed to add workspace member");
    }

    successResponse(res, data, "Member added successfully", 201);
  } catch (error) {
    next(error);
  }
};

export const updateWorkspaceMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, memberId } = req.params;
    const { role } = req.body;

    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .update({ role })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError("Workspace member not found");
    }

    successResponse(res, data, "Member role updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeWorkspaceMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, memberId } = req.params;

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new NotFoundError("Workspace member not found");
    }

    successResponse(res, null, "Member removed successfully");
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthorizationError("User not authenticated");
    }

    // ✅ CRITICAL: Fetch plan limits ONCE to avoid race conditions
    const planLimits = await getUserPlanLimits(req.user.id);

    console.log("✅ Plan limits fetched once:", planLimits);

    // ✅ FIX: Now checking BOTH daily AND weekly limits
    const [aiLimitCheck, docLimitCheck, dailyPostCheck, weeklyPostCheck] = await Promise.all([
      checkAIGenerationLimit(req.user.id, planLimits),
      checkDocumentUploadLimit(req.user.id, planLimits),
      checkDailyPostLimit(req.user.id, planLimits), // ✅ NEW: Daily limit check
      checkWeeklyPostLimit(req.user.id, planLimits)
    ]);

    console.log("🔍 Daily Post Check:", dailyPostCheck);
    console.log("🔍 Weekly Post Check:", weeklyPostCheck);

    successResponse(
      res,
      {
        documentUpload: {
          canUpload: docLimitCheck.canUpload,
          message: docLimitCheck.message,
          currentCount: docLimitCheck.currentCount,
          limit: docLimitCheck.limit,
          remaining: docLimitCheck.limit === 0 ? -1 : docLimitCheck.limit - docLimitCheck.currentCount,
          planType: docLimitCheck.planType,
        },
        aiGeneration: {
          canGenerate: aiLimitCheck.canGenerate,
          message: aiLimitCheck.message,
          currentUsage: aiLimitCheck.currentUsage,
          limit: aiLimitCheck.limit,
          remaining: aiLimitCheck.remaining,
          planType: aiLimitCheck.planType,
        },
        weeklyPosting: {
          canPost: weeklyPostCheck.canPost, // ✅ Weekly limit (2/week for free)
          canPostNow: dailyPostCheck.canPostToday, // ✅ CRITICAL FIX: Daily limit (1/day for free)
          message: !weeklyPostCheck.canPost
            ? weeklyPostCheck.message
            : !dailyPostCheck.canPostToday
              ? dailyPostCheck.message
              : undefined,
          postsThisWeek: weeklyPostCheck.postsThisWeek,
          limit: weeklyPostCheck.limit,
          remaining: weeklyPostCheck.limit === 0 ? -1 : weeklyPostCheck.limit - weeklyPostCheck.postsThisWeek,
          nextResetDate: weeklyPostCheck.nextResetDate,
          planType: weeklyPostCheck.planType,
        },
        linkedinRecommendation: {
          note: "LinkedIn recommends posting 1-2 times per day for optimal engagement. Consistency is more important than frequency.",
          idealFrequency: "1-2 posts/day",
        },
      },
      "Usage limits retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
