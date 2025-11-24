import { Request, Response } from "express";
import supabaseAdmin from "../config/database";
import logger from "../config/logger";
import { 
  getUserPlanLimits, 
  checkDailyPostLimit, 
  checkWeeklyPostLimit, 
  incrementUsage 
} from "../utils/limitCheck";

interface ScheduledPostResponse {
  id: string;
  content: string;
  scheduled_time: string;
  status: string;
  published_at?: string;
  error_message?: string;
  external_post_id?: string;
  platform?: string;
  variant_number?: number;
  social_account?: string;
  timezone?: string;
}

interface ScheduledPost {
  id: string;
  post_id: string;
  social_account_id: string;
  scheduled_time: string;
  status: string;
  retry_count: number;
  published_at?: string;
  error_message?: string;
  external_post_id?: string;
  timezone?: string;
  generated_posts: Array<{
    id: string;
    content: string;
    platform: string;
    variant_number: number;
    media_urls?: string[];
  }>;
  social_accounts: Array<{
    id: string;
    platform: string;
    account_name: string;
    is_active: boolean;
    access_token: string;
    account_id: string;
    token_expires_at: string;
  }>;
}

interface ExistingPost {
  id: string;
  post_id: string;
  workspace_id: string;
  status: string;
}

export class SchedulePostController {
  async getScheduledPosts(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      const { data: scheduledPosts, error } = await supabaseAdmin
        .from("scheduled_posts")
        .select(
          `
        id,
        post_id,
        social_account_id,
        scheduled_time,
        status,
        published_at,
        error_message,
        external_post_id,
        retry_count,
        timezone,
        generated_posts!inner(
          id,
          content,
          platform,
          variant_number,
          media_urls
        ),
        social_accounts!inner(
          platform,
          account_name,
          is_active
        )
      `
        )
        .eq("workspace_id", workspaceId)
        .eq("generated_posts.workspace_id", workspaceId)
        .order("scheduled_time", { ascending: true });

      if (error) {
        logger.error("Database error fetching scheduled posts:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch scheduled posts",
        });
        return;
      }

      const formattedPosts: ScheduledPostResponse[] = (scheduledPosts || [])
        .map((post: any) => {
          const content =
            post.generated_posts?.content ||
            post.generated_posts?.[0]?.content ||
            "Content not available";

          const platform =
            post.generated_posts?.platform ||
            post.generated_posts?.[0]?.platform ||
            "linkedin";

          const variantNumber =
            post.generated_posts?.variant_number ||
            post.generated_posts?.[0]?.variant_number;

          const socialAccount =
            post.social_accounts?.account_name ||
            post.social_accounts?.[0]?.account_name;

          return {
            id: post.id,
            content: content,
            scheduled_time: post.scheduled_time,
            status: post.status || "scheduled",
            published_at: post.published_at,
            error_message: post.error_message,
            external_post_id: post.external_post_id,
            platform: platform,
            variant_number: variantNumber,
            social_account: socialAccount,
            timezone: post.timezone,
          };
        })
        .filter((post) => post.content !== "Content not available");

      res.json({
        success: true,
        data: formattedPosts,
      });
    } catch (error: any) {
      logger.error("Error in getScheduledPosts:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async schedulePost(req: Request, res: Response): Promise<void> {
  try {
    const { workspaceId } = req.params;
    const { postId, socialAccountId, scheduledTime, timezone } = req.body;

    // ✅ FIX: Get userId from authenticated user (NOT from request body)
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    console.log(">>>>> userId:", userId); // Debug log

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "User not authenticated. Please log in.",
      });
      return;
    }

    // Validation: Required fields
    if (!postId || !socialAccountId || !scheduledTime) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: postId, socialAccountId, scheduledTime",
      });
      return;
    }
      // User's timezone (from frontend)
      const userTimezone = timezone || "UTC";
      logger.info(`📅 Scheduling post with timezone: ${userTimezone}`);

      // Parse the scheduled time - it's already in user's local time
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();

      // Validation: Check if time is in the future
      if (scheduledDate <= now) {
        res.status(400).json({
          success: false,
          error: "Scheduled time must be in the future",
        });
        return;
      }

      // Minimum 5 minutes in the future
      const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);
      if (scheduledDate < minScheduleTime) {
        res.status(400).json({
          success: false,
          error: "Scheduled time must be at least 5 minutes in the future",
        });
        return;
      }

      // ✅ NEW: Check if scheduled date is today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const isScheduledToday = scheduledDate >= todayStart && scheduledDate <= todayEnd;

      // ✅ NEW: Get user plan limits
      const planLimits = await getUserPlanLimits(userId);
      
      // ✅ NEW: Check daily post limit if scheduling for today
      if (isScheduledToday) {
        const dailyLimit = await checkDailyPostLimit(userId, planLimits);
        
        logger.info(`🔍 Daily limit check for today's schedule:`, {
          canPostToday: dailyLimit.canPostToday,
          currentDaily: dailyLimit.currentDaily,
          dailyLimit: dailyLimit.dailyLimit,
          planType: dailyLimit.planType
        });

        if (!dailyLimit.canPostToday) {
          const tomorrowDate = new Date(now);
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          tomorrowDate.setHours(0, 0, 0, 0);

          res.status(400).json({
            success: false,
            error: dailyLimit.message || "Daily post limit reached for today",
            suggestion: `You've reached your daily posting limit (${dailyLimit.dailyLimit}). Please schedule this post for tomorrow (${tomorrowDate.toLocaleDateString()}) or later.`,
            data: {
              currentDaily: dailyLimit.currentDaily,
              dailyLimit: dailyLimit.dailyLimit,
              planType: dailyLimit.planType,
              earliestAvailableDate: tomorrowDate.toISOString()
            }
          });
          return;
        }
      }

      // ✅ NEW: Check weekly post limit
      const weeklyLimit = await checkWeeklyPostLimit(userId, planLimits);
      
      logger.info(`🔍 Weekly limit check:`, {
        canPost: weeklyLimit.canPost,
        postsThisWeek: weeklyLimit.postsThisWeek,
        limit: weeklyLimit.limit,
        planType: weeklyLimit.planType
      });

      if (!weeklyLimit.canPost) {
        res.status(400).json({
          success: false,
          error: weeklyLimit.message || "Weekly post limit reached",
          data: {
            postsThisWeek: weeklyLimit.postsThisWeek,
            weeklyLimit: weeklyLimit.limit,
            planType: weeklyLimit.planType,
            nextResetDate: weeklyLimit.nextResetDate
          }
        });
        return;
      }

      // Verify post exists and belongs to workspace
      const { data: post, error: postError } = await supabaseAdmin
        .from("generated_posts")
        .select("id, workspace_id, content, platform")
        .eq("id", postId)
        .eq("workspace_id", workspaceId)
        .single();

      if (postError || !post) {
        logger.error("Post verification failed:", postError);
        res.status(404).json({
          success: false,
          error: "Post not found or access denied",
        });
        return;
      }

      interface SocialAccount {
        id: string;
        workspace_id: string;
        platform: string;
        account_name: string;
        is_active: boolean;
      }

      // Verify social account exists and is active
      const { data: socialAccount, error: accountError } = await supabaseAdmin
        .from("social_accounts")
        .select("id, workspace_id, platform, account_name, is_active")
        .eq("id", socialAccountId)
        .eq("workspace_id", workspaceId)
        .single<SocialAccount>();

      if (accountError || !socialAccount) {
        logger.error("Social account verification failed:", accountError);
        res.status(404).json({
          success: false,
          error: "Social account not found",
        });
        return;
      }

      if (!socialAccount.is_active) {
        res.status(400).json({
          success: false,
          error: "Social account is not active",
        });
        return;
      }

      // Store in UTC, but keep timezone info for display
      const scheduledTimeUTC = scheduledDate.toISOString();

      logger.info(`⏰ Scheduling details:
        - User timezone: ${userTimezone}
        - User local time: ${scheduledTime}
        - UTC time (stored): ${scheduledTimeUTC}
        - Scheduled for today: ${isScheduledToday}
      `);

      // Create scheduled post
      const { data: scheduledPost, error: scheduleError } = await supabaseAdmin
        .from("scheduled_posts")
        .insert([
          {
            workspace_id: workspaceId,
            post_id: postId,
            social_account_id: socialAccountId,
            scheduled_time: scheduledTime,
            status: "scheduled",
            timezone: timezone,
          },
        ] as any)
        .select(
          `
          *,
          generated_posts(
            content,
            platform,
            variant_number
          ),
          social_accounts(
            account_name
          )
        `
        )
        .single<ScheduledPost>();

      if (scheduleError || !scheduledPost) {
        logger.error("Schedule creation error:", scheduleError);
        res.status(500).json({
          success: false,
          error: `Failed to schedule post: ${
            scheduleError?.message || "Unknown error"
          }`,
        });
        return;
      }

      // ✅ NEW: Increment usage counts after successful scheduling
      await incrementUsage({
        type: "weekly_post",
        userId: userId,
        platform: post.platform,
        scheduledTimeISO: scheduledTimeUTC
      });

      // ✅ NEW: If scheduled for today, also increment daily count
      if (isScheduledToday) {
        await incrementUsage({
          type: "daily_post",
          userId: userId,
          platform: post.platform,
          scheduledTimeISO: scheduledTimeUTC
        });
      }

      const responseData: ScheduledPostResponse = {
        id: scheduledPost.id,
        content:
          scheduledPost.generated_posts?.[0]?.content || "No content available",
        scheduled_time: scheduledPost.scheduled_time,
        status: scheduledPost.status,
        platform: scheduledPost.generated_posts?.[0]?.platform,
        variant_number: scheduledPost.generated_posts?.[0]?.variant_number,
        social_account: scheduledPost.social_accounts?.[0]?.account_name,
        timezone: scheduledPost.timezone,
      };

      res.status(201).json({
        success: true,
        data: responseData,
        message: "Post scheduled successfully",
      });
    } catch (error: any) {
      logger.error("Unexpected error in schedulePost:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updateScheduledPost(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, postId } = req.params;
      const { content } = req.body;

      if (
        !content ||
        typeof content !== "string" ||
        content.trim().length === 0
      ) {
        logger.warn("Invalid content provided:", {
          contentType: typeof content,
          contentLength: content?.length,
        });
        res.status(400).json({
          success: false,
          error: "Content is required and must be a non-empty string",
        });
        return;
      }

      const { data: existingPost, error: fetchError } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, post_id, workspace_id, status")
        .eq("id", postId)
        .eq("workspace_id", workspaceId)
        .single<ExistingPost>();

      if (fetchError || !existingPost) {
        logger.error("Database error fetching scheduled post:", {
          error: fetchError,
          postId,
          workspaceId,
        });
        res.status(404).json({
          success: false,
          error: "Scheduled post not found or access denied",
        });
        return;
      }

      if (existingPost.status !== "scheduled") {
        logger.warn("Attempt to edit non-scheduled post:", {
          postId,
          currentStatus: existingPost.status,
        });
        res.status(400).json({
          success: false,
          error: `Cannot edit ${existingPost.status} posts. Only scheduled posts can be edited.`,
        });
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from("generated_posts")
        .update({
          content: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPost.post_id);

      if (updateError) {
        logger.error("Error updating generated post content:", {
          error: updateError,
          generatedPostId: existingPost.post_id,
        });
        res.status(500).json({
          success: false,
          error: "Failed to update post content in database",
          details: updateError.message,
        });
        return;
      }

      res.json({
        success: true,
        message: "Post updated successfully",
        data: {
          id: postId,
          content: content.trim(),
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error("Unexpected error in updateScheduledPost:", {
        error: error.message,
        stack: error.stack,
        postId: req.params.postId,
        workspaceId: req.params.workspaceId,
      });
      res.status(500).json({
        success: false,
        error: "Internal server error while updating post",
      });
    }
  }

  async deleteScheduledPost(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, postId } = req.params;

      const { data: existingPost, error: fetchError } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id")
        .eq("id", postId)
        .eq("workspace_id", workspaceId)
        .single();

      if (fetchError || !existingPost) {
        res.status(404).json({
          success: false,
          error: "Scheduled post not found or access denied",
        });
        return;
      }

      const { error: deleteError } = await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .eq("id", postId)
        .eq("workspace_id", workspaceId);

      if (deleteError) {
        logger.error("Delete error:", deleteError);
        res.status(500).json({
          success: false,
          error: "Failed to delete scheduled post",
        });
        return;
      }

      res.json({
        success: true,
        message: "Scheduled post deleted successfully",
      });
    } catch (error: any) {
      logger.error("Error in deleteScheduledPost:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const schedulePostController = new SchedulePostController();