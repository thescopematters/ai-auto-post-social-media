import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import logger from "../config/logger";
import * as fs from "fs";
import * as path from "path";

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
        return;
      }

      this.isRunning = true;
      try {
        await this.processScheduledPosts();
      } catch (error) {
        logger.error("Scheduler error:", error);
      } finally {
        this.isRunning = false;
      }
    });
  }

  private async processScheduledPosts() {
    const now = new Date();
    const nowISOString = now.toISOString();

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
        generated_posts(id, content, platform, media_urls),
        social_accounts(account_name, platform, is_active, token_expires_at, access_token, account_id)
      `
        )
        .lte("scheduled_time", nowISOString)
        .eq("status", "scheduled")
        .lt("retry_count", MAX_RETRIES);

      if (postsError) {
        logger.error("Error fetching scheduled posts:", postsError);
        return;
      }

      if (!scheduledPosts || scheduledPosts.length === 0) {
        return;
      }

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
          media_urls: scheduledPost.generated_posts?.[0]?.media_urls || [],
          account_name: scheduledPost.social_accounts?.[0]?.account_name,
          is_active: scheduledPost.social_accounts?.[0]?.is_active,
          token_expires_at:
            scheduledPost.social_accounts?.[0]?.token_expires_at,
          access_token: scheduledPost.social_accounts?.[0]?.access_token,
          account_id: scheduledPost.social_accounts?.[0]?.account_id,
        };

        await this.sleep(500);

        const result = await this.publishToLinkedIn(flatPost);

        if (!result.success) {
          logger.error(`Failed to publish post ${flatPost.id}:`, result.error);
        }
      }
    } catch (error) {
      logger.error("Error in processScheduledPosts:", error);
    }
  }

  public async publishToLinkedIn(
    scheduledPost: any
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    const postId = scheduledPost.id;

    try {
      const socialAccountId = scheduledPost.social_account_id;
      const generatedPostId = scheduledPost.post_id;

      if (!socialAccountId || !generatedPostId) {
        return {
          success: false,
          error: `Missing required fields: socialAccountId=${socialAccountId}, generatedPostId=${generatedPostId}`,
        };
      }

      let generatedPost = {
        content: scheduledPost.content,
        platform: scheduledPost.platform || "linkedin",
        media_urls: scheduledPost.media_urls || [],
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
          .select("content, platform, media_urls")
          .eq("id", generatedPostId)
          .single();

        if (postError || !fetchedPost) {
          logger.error("Generated post not found:", postError);
          return {
            success: false,
            error: "Generated post not found",
          };
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
          logger.error("Social account not found:", accountError);
          return {
            success: false,
            error: "Social account not found",
          };
        }
        socialAccount = fetchedAccount;
      }

      // Validate account
      if (!socialAccount.is_active) {
        logger.error("Social account is not active", {
          accountId: socialAccountId,
          isActive: socialAccount.is_active,
        });
        return {
          success: false,
          error: "Social account is not active",
        };
      }

      if (socialAccount.platform !== "linkedin") {
        logger.error("Unsupported platform:", socialAccount.platform);
        return {
          success: false,
          error: `Unsupported platform: ${socialAccount.platform}`,
        };
      }

      // Check token expiry
      const tokenExpiry = new Date(socialAccount.token_expires_at);
      const now = new Date();
      if (tokenExpiry <= now) {
        logger.error("LinkedIn access token has expired", {
          expiresAt: socialAccount.token_expires_at,
          now: now.toISOString(),
        });
        return {
          success: false,
          error: "LinkedIn access token has expired",
        };
      }

      // Upload images to LinkedIn first
      let imageUrns: string[] = [];
      if (generatedPost.media_urls && generatedPost.media_urls.length > 0) {
        imageUrns = await this.uploadImagesToLinkedIn(
          generatedPost.media_urls,
          socialAccount.access_token,
          socialAccount.account_id
        );
      }

      // Try to publish to LinkedIn
      const result = await this.makeLinkedInPost(
        generatedPost.content,
        socialAccount.access_token,
        socialAccount.account_id,
        imageUrns
      );

      if (result.success && result.postId) {
        // Update the database for successful publish
        await this.markPostAsPublished(postId, result.postId);
        return {
          success: true,
          postId: result.postId,
        };
      } else {
        // Update the database for failed publish
        await this.markPostAsFailed(postId, result.error || "Unknown error");
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error: any) {
      logger.error(`Error publishing post ${postId}:`, {
        error: error.message,
        stack: error.stack,
      });

      // Update the database for failed publish
      await this.markPostAsFailed(postId, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async uploadImagesToLinkedIn(
    mediaPaths: string[],
    accessToken: string,
    personUrn: string
  ): Promise<string[]> {
    const imageUrns: string[] = [];

    for (const mediaPath of mediaPaths) {
      try {
        const fullPath = path.join(process.cwd(), mediaPath);

        if (!fs.existsSync(fullPath)) {
          logger.warn(`Media file not found: ${fullPath}`);
          continue;
        }

        const imageBuffer = fs.readFileSync(fullPath);
        const mimeType = this.getMimeType(mediaPath);

        // Step 1: Initialize image upload
        const registerResponse = await fetch(
          "https://api.linkedin.com/v2/assets?action=registerUpload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: `urn:li:person:${personUrn}`,
                serviceRelationships: [
                  {
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent",
                  },
                ],
              },
            }),
          }
        );

        if (!registerResponse.ok) {
          const errorText = await registerResponse.text();
          logger.error("LinkedIn image registration failed:", errorText);
          continue;
        }

        const registerData = await registerResponse.json();
        const uploadUrl =
          registerData.value.uploadMechanism[
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
          ].uploadUrl;
        const assetUrn = registerData.value.asset;

        // Step 2: Upload image to presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": mimeType,
          },
          body: imageBuffer,
        });

        if (!uploadResponse.ok) {
          logger.error("LinkedIn image upload failed:", uploadResponse.status);
          continue;
        }
        imageUrns.push(assetUrn);
      } catch (error: any) {
        logger.error(`Error uploading image ${mediaPath}:`, error.message);
        continue;
      }
    }

    return imageUrns;
  }

  private async makeLinkedInPost(
    content: string,
    accessToken: string,
    personUrn: string,
    imageUrns: string[] = []
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      const shareMediaCategory = imageUrns.length > 0 ? "IMAGE" : "NONE";
      const shareContent: any = {
        shareCommentary: {
          text: content,
        },
      };

      if (imageUrns.length > 0) {
        shareContent.shareMediaCategory = "IMAGE";
        shareContent.media = imageUrns.map((urn) => ({
          status: "READY",
          media: urn,
        }));
      } else {
        shareContent.shareMediaCategory = "NONE";
      }

      const postData = {
        author: `urn:li:person:${personUrn}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": shareContent,
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

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

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("LinkedIn API error response:", {
          status: response.status,
          body: errorText,
        });

        if (response.status === 401 || response.status === 403) {
          logger.error(
            "Authentication failed - Token may be invalid or revoked"
          );
          return {
            success: false,
            error: `Auth failed (${response.status}): ${errorText}`,
          };
        }

        if (response.status === 400) {
          logger.error("Bad Request - Check API payload format");
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

      return {
        success: true,
        postId: data.id,
      };
    } catch (error: any) {
      logger.error("LinkedIn API call failed:", {
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return mimeTypes[ext] || "image/jpeg";
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
        logger.error("Error marking post as published:", error);
      } else {
        logger.info(`Post ${postId} marked as published`);
      }
    } catch (error) {
      logger.error("Error in markPostAsPublished:", error);
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
        logger.error("Error marking post as failed:", error);
      } else {
        logger.info(`Post ${postId} marked as failed`);
      }
    } catch (error) {
      logger.error("Error in markPostAsFailed:", error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async publishNow(req: Request, res: Response): Promise<void> {
    try {
      const { postId, socialAccountId } = req.body;

      if (!postId || !socialAccountId) {
        res.status(400).json({
          success: false,
          error: "Missing postId or socialAccountId",
        });
        return;
      }

      // Fetch the generated post to get workspace_id
      const { data: generatedPost, error: postError } = await supabase
        .from("generated_posts")
        .select("id, content, media_urls, platform, workspace_id")
        .eq("id", postId)
        .single();

      if (postError || !generatedPost) {
        res.status(404).json({
          success: false,
          error: "Generated post not found",
        });
        return;
      }

      // Fetch social account for access token
      const { data: socialAccount, error: accountError } = await supabase
        .from("social_accounts")
        .select(
          "id, account_id, access_token, token_expires_at, is_active, platform"
        )
        .eq("id", socialAccountId)
        .single();

      if (accountError || !socialAccount) {
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

      // Check token expiry
      const tokenExpiry = new Date(socialAccount.token_expires_at);
      const now = new Date();
      if (tokenExpiry <= now) {
        res.status(400).json({
          success: false,
          error: "Access token expired, please reconnect LinkedIn",
        });
        return;
      }

      // Create a scheduled_post record with workspace_id
      const scheduledTime = new Date().toISOString();
      const scheduledPostData = {
        workspace_id: generatedPost.workspace_id, // Add this line
        post_id: postId,
        social_account_id: socialAccountId,
        scheduled_time: scheduledTime,
        status: "scheduled",
        retry_count: 0,
      };

      const { data: scheduledPost, error: createError } = await supabase
        .from("scheduled_posts")
        .insert(scheduledPostData)
        .select(
          `
        id,
        workspace_id,
        post_id,
        social_account_id,
        scheduled_time,
        status,
        retry_count,
        generated_posts(id, content, platform, media_urls),
        social_accounts(account_name, platform, is_active, token_expires_at, access_token, account_id)
      `
        )
        .single();

      if (createError) {
        console.error("Error creating scheduled post:", createError);
        logger.error("Error creating scheduled post:", createError);
        res.status(500).json({
          success: false,
          error: `Failed to create scheduled post: ${createError.message}`,
        });
        return;
      }

      if (!scheduledPost) {
        console.error("No scheduled post data returned");
        res.status(500).json({
          success: false,
          error: "Failed to create scheduled post - no data returned",
        });
        return;
      }
      
      const flatPost = {
        id: scheduledPost.id,
        workspace_id: scheduledPost.workspace_id,
        post_id: scheduledPost.post_id,
        social_account_id: scheduledPost.social_account_id,
        scheduled_time: scheduledPost.scheduled_time,
        status: scheduledPost.status,
        retry_count: scheduledPost.retry_count,
        content:
          scheduledPost.generated_posts?.[0]?.content || generatedPost.content,
        platform:
          scheduledPost.generated_posts?.[0]?.platform || generatedPost.platform,
        media_urls:
          scheduledPost.generated_posts?.[0]?.media_urls ||
          generatedPost.media_urls ||
          [],
        account_name: scheduledPost.social_accounts?.[0]?.account_name,
        is_active: scheduledPost.social_accounts?.[0]?.is_active,
        token_expires_at: scheduledPost.social_accounts?.[0]?.token_expires_at,
        access_token: scheduledPost.social_accounts?.[0]?.access_token,
        account_id: scheduledPost.social_accounts?.[0]?.account_id,
      };

      const result = await this.publishToLinkedIn(flatPost);

      if (result.success) {
        res.json({
          success: true,
          message: "Post published successfully",
          linkedinPostId: result.postId,
          scheduledPostId: scheduledPost.id,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to publish post",
        });
      }
    } catch (error: any) {
      console.error("Unexpected error in publishNow:", error);
      logger.error("Error in publishNow:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const schedulerController = new SchedulerController();
