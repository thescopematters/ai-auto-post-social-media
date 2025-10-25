import { Request, Response } from "express";
import supabaseAdmin from "../config/database";
import logger from "../config/logger";
import { schedulerController } from "./scheduler.controller";

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
}

export class SchedulePostController {
  async getScheduledPosts(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      logger.info("Fetching scheduled posts for workspace:", { workspaceId });

      const { data: scheduledPosts, error } = await supabaseAdmin
        .from("scheduled_posts")
        .select(
          `
          *,
          generated_posts(
            content,
            platform,
            variant_number
          ),
          social_accounts(
            platform,
            account_name
          )
        `
        )
        .eq("workspace_id", workspaceId)
        .order("scheduled_time", { ascending: true });

      if (error) {
        logger.error("Database error fetching scheduled posts:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch scheduled posts",
        });
        return;
      }

      logger.info("Found scheduled posts:", {
        count: scheduledPosts?.length || 0,
      });

      // Format the response
      const formattedPosts: ScheduledPostResponse[] = (
        scheduledPosts || []
      ).map((post: any) => ({
        id: post.id,
        content: post.generated_posts?.content || "No content available",
        scheduled_time: post.scheduled_time,
        status: post.status || "scheduled",
        published_at: post.published_at,
        error_message: post.error_message,
        external_post_id: post.external_post_id,
        platform: post.generated_posts?.platform || "linkedin",
        variant_number: post.generated_posts?.variant_number,
        social_account: post.social_accounts?.account_name,
      }));

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
      const { postId, socialAccountId, scheduledTime } = req.body;

      logger.info("Scheduling post:", {
        workspaceId,
        postId,
        socialAccountId,
        scheduledTime,
      });

      // Validate required fields
      if (!postId || !socialAccountId || !scheduledTime) {
        res.status(400).json({
          success: false,
          error:
            "Missing required fields: postId, socialAccountId, scheduledTime",
        });
        return;
      }

      // Validate scheduled time is in the future
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      if (scheduledDate <= now) {
        res.status(400).json({
          success: false,
          error: "Scheduled time must be in the future",
        });
        return;
      }

      // Verify the post belongs to the workspace
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

      // Verify the social account belongs to the workspace and is active
      type SocialAccount = {
        id: string;
        workspace_id: string;
        platform: string;
        account_name: string;
        is_active: boolean;
      };

      const { data: socialAccount, error: accountError } = await supabaseAdmin
        .from("social_accounts")
        .select("id, workspace_id, platform, account_name, is_active")
        .eq("id", socialAccountId)
        .eq("workspace_id", workspaceId)
        .single();

      const typedSocialAccount = socialAccount as SocialAccount | null;

      if (accountError || !typedSocialAccount) {
        logger.error("Social account verification failed:", accountError);
        res.status(404).json({
          success: false,
          error: "Social account not found",
        });
        return;
      }

      if (!typedSocialAccount.is_active) {
        res.status(400).json({
          success: false,
          error: "Social account is not active",
        });
        return;
      }

      // Create scheduled post
      type ScheduledPostDB = {
        id: string;
        generated_posts: {
          content: string;
          platform: string;
          variant_number: number;
        } | null;
        social_accounts: {
          account_name: string;
        } | null;
        scheduled_time: string;
        status: string;
      };

      const { data: scheduledPost, error: scheduleError } = await supabaseAdmin
        .from("scheduled_posts")
        .insert({
          workspace_id: workspaceId,
          post_id: postId,
          social_account_id: socialAccountId,
          scheduled_time: scheduledTime,
          status: "scheduled",
        } as any)
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
        .single<ScheduledPostDB>();

      if (scheduleError) {
        logger.error("Schedule creation error:", scheduleError);
        res.status(500).json({
          success: false,
          error: `Failed to schedule post: ${scheduleError.message}`,
        });
        return;
      }

      logger.info("Post scheduled successfully:", {
        scheduledPostId: scheduledPost.id,
        workspaceId,
      });

      // Format the response
      const responseData: ScheduledPostResponse = {
        id: scheduledPost.id,
        content:
          scheduledPost.generated_posts?.content || "No content available",
        scheduled_time: scheduledPost.scheduled_time,
        status: scheduledPost.status,
        platform: scheduledPost.generated_posts?.platform,
        variant_number: scheduledPost.generated_posts?.variant_number,
        social_account: scheduledPost.social_accounts?.account_name,
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

  async deleteScheduledPost(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, postId } = req.params;

      logger.info("Deleting scheduled post:", { workspaceId, postId });

      // Verify the post belongs to the workspace before deleting
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

      const { error } = await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .eq("id", postId)
        .eq("workspace_id", workspaceId);

      if (error) {
        logger.error("Delete error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to delete scheduled post",
        });
        return;
      }

      logger.info("Scheduled post deleted successfully:", { postId });

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

  async publishNow(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.body;

      if (!postId) {
        res.status(400).json({
          success: false,
          error: "postId is required",
        });
        return;
      }

      logger.info("Publishing post immediately:", { postId });

      // Get the scheduled post with related data
      const { data: scheduledPost, error: fetchError } = await supabaseAdmin
        .from("scheduled_posts")
        .select(
          `
        *,
        generated_posts(
          content,
          platform
        ),
        social_accounts(
          access_token,
          account_id,
          platform,
          account_name
        )
      `
        )
        .eq("id", postId)
        .single();

      if (fetchError || !scheduledPost) {
        logger.error("Post not found:", fetchError);
        res.status(404).json({
          success: false,
          error: "Scheduled post not found",
        });
        return;
      }

      // Use the existing schedulerController instance
      await schedulerController.publishToLinkedIn(scheduledPost);

      // Check the status after publishing
      type UpdatedPost = {
        status: string;
        error_message?: string;
        external_post_id?: string;
      };

      const { data: updatedPost } = await supabaseAdmin
        .from("scheduled_posts")
        .select("status, error_message, external_post_id")
        .eq("id", postId)
        .single<UpdatedPost>();

      if (updatedPost?.status === "published") {
        logger.info("Post published successfully:", {
          postId,
          externalPostId: updatedPost.external_post_id,
        });

        res.json({
          success: true,
          message: "Post published successfully to LinkedIn",
          data: {
            id: postId,
            published_at: new Date().toISOString(),
            external_post_id: updatedPost.external_post_id,
          },
        });
      } else {
        logger.error("Post publishing failed:", {
          postId,
          error: updatedPost?.error_message,
        });

        res.status(500).json({
          success: false,
          error: `Failed to publish post: ${
            updatedPost?.error_message || "Unknown error"
          }`,
        });
      }
    } catch (error: any) {
      logger.error("Error in publishNow:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// Export singleton instance
export const schedulePostController = new SchedulePostController();
