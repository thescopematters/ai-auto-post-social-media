// @ts-nocheck
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { successResponse } from "../utils/response";

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const [documentsRes, postsRes, scheduledRes, moderationRes] =
      await Promise.all([
        supabaseAdmin
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),

        supabaseAdmin
          .from("generated_posts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),

        supabaseAdmin
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .or(`status.eq.scheduled,status.eq.pending,status.eq.published`),

        supabaseAdmin
          .from("generated_posts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("moderation_status", "pending"),
      ]);

    const stats = {
      totalDocuments: documentsRes.count || 0,
      totalPosts: postsRes.count || 0,
      scheduledPosts: scheduledRes.count || 0,
      pendingModeration: moderationRes.count || 0,
      publishedThisMonth: 0,
      avgEngagementRate: 0,
    };

    successResponse(res, stats, "Dashboard statistics retrieved successfully");
  } catch (error) {
    console.error("Error fetching stats:", error);
    next(error);
  }
};

export const getRecentActivity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .select("*, documents(title)")
      .eq("workspace_id", workspaceId)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error("Failed to fetch recent activity");
    }

    successResponse(res, data || [], "Recent activity retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const { data: analytics, error } = await supabaseAdmin
      .from("post_analytics")
      .select("*, scheduled_posts!inner(workspace_id)")
      .eq("scheduled_posts.workspace_id", workspaceId)
      .order("fetched_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error("Failed to fetch analytics");
    }

    const aggregated = {
      totalImpressions:
        analytics?.reduce((sum, a) => sum + a.impressions_count, 0) || 0,
      totalEngagement:
        analytics?.reduce(
          (sum, a) => sum + a.likes_count + a.comments_count + a.shares_count,
          0
        ) || 0,
      totalClicks: analytics?.reduce((sum, a) => sum + a.clicks_count, 0) || 0,
      avgEngagementRate: analytics?.length
        ? analytics.reduce((sum, a) => sum + a.engagement_rate, 0) /
          analytics.length
        : 0,
      byPlatform: analytics?.reduce((acc: any, a) => {
        if (!acc[a.platform]) {
          acc[a.platform] = { impressions: 0, engagement: 0, posts: 0 };
        }
        acc[a.platform].impressions += a.impressions_count;
        acc[a.platform].engagement +=
          a.likes_count + a.comments_count + a.shares_count;
        acc[a.platform].posts += 1;
        return acc;
      }, {}),
    };

    successResponse(res, aggregated, "Analytics retrieved successfully");
  } catch (error) {
    next(error);
  }
};
