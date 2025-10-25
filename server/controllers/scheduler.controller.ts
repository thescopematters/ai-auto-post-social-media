import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import logger from "../config/logger";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_RETRIES = 3;

export class SchedulerController {
  private isRunning = false;

startScheduler() {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    if (this.isRunning) {
      logger.info("⏭️ Scheduler already running, skipping");
      return;
    }

    this.isRunning = true;
    try {
      await this.processScheduledPosts();
    } catch (error) {
      logger.error("❌ Scheduler error:", error);
    } finally {
      this.isRunning = false;
    }
  });

  logger.info("✅ Scheduler started - runs every 1 minute");
}

private async processScheduledPosts() {
  const now = new Date();
  const nowISOString = now.toISOString();

  logger.info(`🔍 Checking for posts due at ${nowISOString}`);

  try {
    const { data: scheduledPosts, error: postsError } = await supabase
      .from("scheduled_posts")
      .select(
        `
        id,
        post_id,
        social_account_id,
        scheduled_time,
        status,
        retry_count,
        generated_posts(content, platform),
        social_accounts(account_name, platform, is_active, token_expires_at, access_token, account_id)
      `
      )
      .lte("scheduled_time", nowISOString) 
      .eq("status", "scheduled")
      .lt("retry_count", MAX_RETRIES);

    if (postsError) {
      logger.error("❌ Error fetching scheduled posts:", postsError);
      return;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      logger.info("✅ No posts to publish right now");
      return;
    }

    logger.info(`📤 Found ${scheduledPosts.length} post(s) to publish`);

    for (const scheduledPost of scheduledPosts) {
      const flatPost = {
        id: scheduledPost.id,
        post_id: scheduledPost.post_id,
        social_account_id: scheduledPost.social_account_id,
        scheduled_time: scheduledPost.scheduled_time,
        status: scheduledPost.status,
        retry_count: scheduledPost.retry_count,
        content: scheduledPost.generated_posts?.[0]?.content,
        platform: scheduledPost.generated_posts?.[0]?.platform,
        account_name: scheduledPost.social_accounts?.[0]?.account_name,
        is_active: scheduledPost.social_accounts?.[0]?.is_active,
        token_expires_at: scheduledPost.social_accounts?.[0]?.token_expires_at,
        access_token: scheduledPost.social_accounts?.[0]?.access_token,
        account_id: scheduledPost.social_accounts?.[0]?.account_id,
      };

      await this.sleep(500);
      await this.publishToLinkedIn(flatPost);
    }
  } catch (error) {
    logger.error("❌ Error in processScheduledPosts:", error);
  }
}

  public async publishToLinkedIn(scheduledPost: any) {
    const postId = scheduledPost.id;

    try {
      const socialAccountId = scheduledPost.social_account_id;
      const generatedPostId = scheduledPost.post_id;

      logger.info(`📝 Publishing post ${postId}`, {
        socialAccountId,
        generatedPostId,
      });

      if (!socialAccountId || !generatedPostId) {
        throw new Error(
          `Missing required fields: socialAccountId=${socialAccountId}, generatedPostId=${generatedPostId}`
        );
      }

      let generatedPost = {
        content: scheduledPost.content,
        platform: scheduledPost.platform || "linkedin",
      };

      let socialAccount = {
        account_name: scheduledPost.account_name,
        platform: scheduledPost.platform || "linkedin",
        is_active: scheduledPost.is_active,
        token_expires_at: scheduledPost.token_expires_at,
        access_token: scheduledPost.access_token,
        account_id: scheduledPost.account_id,
      };

      if (!generatedPost.content) {
        const { data: fetchedPost, error: postError } = await supabase
          .from("generated_posts")
          .select("content, platform")
          .eq("id", generatedPostId)
          .single();

        if (postError || !fetchedPost) {
          logger.error("❌ Generated post not found:", postError);
          throw new Error("Generated post not found");
        }
        generatedPost = fetchedPost;
      }

      if (!socialAccount.access_token) {
        const { data: fetchedAccount, error: accountError } = await supabase
          .from("social_accounts")
          .select("*")
          .eq("id", socialAccountId)
          .single();

        if (accountError || !fetchedAccount) {
          logger.error("❌ Social account not found:", accountError);
          throw new Error("Social account not found");
        }
        socialAccount = fetchedAccount;
      }

      logger.info(`✅ Generated post found:`, {
        content: generatedPost.content.substring(0, 50) + "...",
        platform: generatedPost.platform,
      });

      logger.info(`✅ Social account found:`, {
        accountName: socialAccount.account_name,
        platform: socialAccount.platform,
        isActive: socialAccount.is_active,
      });

      // Validate account
      if (!socialAccount.is_active) {
        logger.error("❌ Social account is not active", {
          accountId: socialAccountId,
          isActive: socialAccount.is_active,
        });
        throw new Error("Social account is not active");
      }

      if (socialAccount.platform !== "linkedin") {
        logger.error("❌ Unsupported platform:", socialAccount.platform);
        throw new Error(`Unsupported platform: ${socialAccount.platform}`);
      }

      // Check token expiry
      const tokenExpiry = new Date(socialAccount.token_expires_at);
      const now = new Date();
      if (tokenExpiry <= now) {
        logger.error("❌ LinkedIn access token has expired", {
          expiresAt: socialAccount.token_expires_at,
          now: now.toISOString(),
        });
        throw new Error("LinkedIn access token has expired");
      }

      logger.info(`✅ Token valid until: ${socialAccount.token_expires_at}`);
      logger.info(
        "⏭️ Skipping token validation, attempting to post directly..."
      );

      // Try to publish to LinkedIn
      const result = await this.makeLinkedInPost(
        generatedPost.content,
        socialAccount.access_token,
        socialAccount.account_id
      );

      if (result.success && result.postId) {
        await this.markPostAsPublished(postId, result.postId);
        logger.info(`✅ Post ${postId} published successfully`, {
          linkedInPostId: result.postId,
        });
      } else {
        await this.incrementRetryCount(postId);
        logger.error(`❌ Failed to publish post ${postId}: ${result.error}`);
      }
    } catch (error: any) {
      logger.error(`❌ Error publishing post ${postId}:`, {
        error: error.message,
        stack: error.stack,
      });

      // Retry logic
      try {
        const { data: currentPost } = await supabase
          .from("scheduled_posts")
          .select("retry_count")
          .eq("id", postId)
          .single();

        if (currentPost && currentPost.retry_count < MAX_RETRIES) {
          await this.incrementRetryCount(postId);
          logger.info(
            `🔄 Retry ${
              currentPost.retry_count + 1
            }/${MAX_RETRIES} for post ${postId}`
          );
        } else {
          await this.markPostAsFailed(postId, error.message);
          logger.error(`❌ Post ${postId} failed after ${MAX_RETRIES} retries`);
        }
      } catch (retryError) {
        logger.error("Error handling retry logic:", retryError);
      }
    }
  }
  private async makeLinkedInPost(
    content: string,
    accessToken: string,
    personUrn: string
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      logger.info(`📤 Preparing LinkedIn post`, {
        personUrn,
        contentLength: content.length,
      });

      const postData = {
        author: `urn:li:person:${personUrn}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      logger.info(
        "📤 LinkedIn API Request Payload:",
        JSON.stringify(postData, null, 2)
      );

      const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          Accept: "application/json",
          "User-Agent": "ContentAI/1.0",
        },
        body: JSON.stringify(postData),
      });

      logger.info("LinkedIn API Response Status:", {
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("❌ LinkedIn API error response:", {
          status: response.status,
          body: errorText,
        });

        // Handle specific errors
        if (response.status === 401 || response.status === 403) {
          logger.error(
            "❌ Authentication failed - Token may be invalid or revoked"
          );
          return {
            success: false,
            error: `Auth failed (${response.status}): ${errorText}`,
          };
        }

        if (response.status === 400) {
          logger.error("❌ Bad Request - Check API payload format");
          return {
            success: false,
            error: `Bad request: ${errorText}`,
          };
        }

        throw new Error(
          `LinkedIn API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      logger.info("✅ LinkedIn post created successfully:", {
        postId: data.id,
      });

      return {
        success: true,
        postId: data.id,
      };
    } catch (error: any) {
      logger.error("❌ LinkedIn API call failed:", {
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async validateLinkedInToken(accessToken: string): Promise<boolean> {
    try {
      logger.info("🔐 Validating LinkedIn access token...");

      logger.info("Token preview:", {
        tokenStart: accessToken.substring(0, 20) + "...",
        tokenLength: accessToken.length,
      });

      const response = await fetch("https://api.linkedin.com/v2/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "User-Agent": "ContentAI/1.0",
        },
      });

      logger.info("LinkedIn validation response:", {
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) {
        const data = await response.json();
        logger.info("✅ LinkedIn token is valid", { sub: data.sub });
        return true;
      }

      // Get error details
      const errorText = await response.text();
      logger.error("LinkedIn validation error details:", {
        status: response.status,
        body: errorText,
      });

      if (response.status === 403) {
        logger.error(
          "❌ 403 Forbidden - Token is revoked or has insufficient permissions"
        );
        return false;
      }

      if (response.status === 401) {
        logger.error("❌ 401 Unauthorized - Token is invalid");
        return false;
      }

      logger.warn("⚠️ LinkedIn validation returned:", {
        status: response.status,
      });
      return false;
    } catch (error: any) {
      logger.error("❌ Error validating LinkedIn token:", {
        error: error.message,
      });
      return false;
    }
  }

  private async markPostAsPublished(
    postId: string,
    linkedinPostId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          external_post_id: linkedinPostId,
          retry_count: 0,
        })
        .eq("id", postId);

      if (error) {
        logger.error("❌ Error marking post as published:", error);
      } else {
        logger.info(`✅ Post ${postId} marked as published`);
      }
    } catch (error) {
      logger.error("❌ Error in markPostAsPublished:", error);
    }
  }

  private async markPostAsFailed(
    postId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", postId);

      if (error) {
        logger.error("❌ Error marking post as failed:", error);
      } else {
        logger.info(`✅ Post ${postId} marked as failed`);
      }
    } catch (error) {
      logger.error("❌ Error in markPostAsFailed:", error);
    }
  }

  private async incrementRetryCount(postId: string): Promise<void> {
    try {
      const { data: post } = await supabase
        .from("scheduled_posts")
        .select("retry_count")
        .eq("id", postId)
        .single();

      if (post) {
        const { error } = await supabase
          .from("scheduled_posts")
          .update({
            retry_count: (post.retry_count || 0) + 1,
          })
          .eq("id", postId);

        if (error) {
          logger.error("❌ Error incrementing retry count:", error);
        }
      }
    } catch (error) {
      logger.error("❌ Error in incrementRetryCount:", error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async manualPublish(req: Request, res: Response): Promise<void> {
    try {
      logger.info("🚀 Manual publish triggered");
      await this.processScheduledPosts();
      res.json({
        success: true,
        message: "Manual publishing triggered",
      });
    } catch (error: any) {
      logger.error("❌ Error in manual publish:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const schedulerController = new SchedulerController();
