// scheduler.controller.ts
import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import logger from "../config/logger";
import fetch from "node-fetch";
import {
  checkWeeklyPostLimit,
  checkDailyPostLimit,
  incrementUsage,
} from "../utils/limitCheck";


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_RETRIES = 3;
const POSTS_PER_ACCOUNT = 5;
const MAX_ACCOUNTS_PER_RUN = 10;

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

    let totalProcessed = 0;
    let accountsProcessed = 0;

    try {
      // Get distinct social accounts that have pending posts
      const { data: accountsWithPosts, error: accountsError } = await supabase
        .from("scheduled_posts")
        .select("social_account_id")
        .lte("scheduled_time", nowISOString)
        .eq("status", "scheduled")
        .lt("retry_count", MAX_RETRIES)
        .limit(100);

      if (accountsError) {
        logger.error("Error fetching scheduled posts:", accountsError);
        return;
      }

      if (!accountsWithPosts || accountsWithPosts.length === 0) {
        return;
      }

      const uniqueAccountIds = [
        ...new Set(accountsWithPosts.map((p) => p.social_account_id)),
      ].slice(0, MAX_ACCOUNTS_PER_RUN);

      for (const socialAccountId of uniqueAccountIds) {
        accountsProcessed++;

        const { data: accountPosts, error: postsError } = await supabase
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
          .eq("social_account_id", socialAccountId)
          .lte("scheduled_time", nowISOString)
          .eq("status", "scheduled")
          .lt("retry_count", MAX_RETRIES)
          .order("scheduled_time", { ascending: true })
          .limit(POSTS_PER_ACCOUNT);

        if (postsError || !accountPosts || accountPosts.length === 0) {
          logger.warn(`⚠️ No posts found for account ${socialAccountId}`);
          continue;
        }

        const accountName =
          accountPosts[0]?.social_accounts?.[0]?.account_name || "Unknown";

        const socialAccount = accountPosts[0]?.social_accounts?.[0];

        if (!socialAccount) {
          logger.error(
            `❌ Social account data not found for ID: ${socialAccountId}`
          );
          continue;
        }

        if (!socialAccount.is_active) {
          logger.warn(
            `🚫 Account ${accountName} is inactive. Failing all ${accountPosts.length} posts.`
          );

          for (const post of accountPosts) {
            await this.markPostAsFailed(
              post.id,
              "LinkedIn account has been disconnected. Please reconnect your account."
            );
          }

          totalProcessed += accountPosts.length;
          continue;
        }

        const tokenExpiry = new Date(socialAccount.token_expires_at);
        if (tokenExpiry <= now) {
          logger.warn(
            `⏰ Account ${accountName} token expired. Failing all ${accountPosts.length} posts.`
          );

          for (const post of accountPosts) {
            await this.markPostAsFailed(
              post.id,
              "LinkedIn access token has expired. Please reconnect your account."
            );
          }

          await supabase
            .from("social_accounts")
            .update({ is_active: false })
            .eq("id", socialAccountId);

          totalProcessed += accountPosts.length;
          continue;
        }

        let successCount = 0;
        let failCount = 0;

        for (const scheduledPost of accountPosts) {
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
            account_name: socialAccount.account_name,
            is_active: socialAccount.is_active,
            token_expires_at: socialAccount.token_expires_at,
            access_token: socialAccount.access_token,
            account_id: socialAccount.account_id,
          };

          await this.sleep(500);

          const result = await this.publishToLinkedIn(flatPost);

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.error(`  ❌ Post ${flatPost.id} failed: ${result.error}`);

            if (
              result.error?.includes("Auth failed") ||
              result.error?.includes("authentication failed") ||
              result.error?.includes("disconnected")
            ) {
              logger.warn(
                `🚫 Auth error detected. Stopping further posts for account ${accountName}`
              );

              const remainingPosts = accountPosts.slice(
                accountPosts.indexOf(scheduledPost) + 1
              );
              for (const remainingPost of remainingPosts) {
                await this.markPostAsFailed(
                  remainingPost.id,
                  "LinkedIn account authentication failed. Please reconnect your account."
                );
                failCount++;
              }
              break;
            }
          }

          totalProcessed++;
        }

        await this.sleep(1000);
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
        const errorMsg = `Missing required fields: socialAccountId=${socialAccountId}, generatedPostId=${generatedPostId}`;
        await this.markPostAsFailed(postId, errorMsg);
        return {
          success: false,
          error: errorMsg,
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
          await this.markPostAsFailed(postId, "Generated post not found");
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
          await this.markPostAsFailed(postId, "Social account not found");
          return {
            success: false,
            error: "Social account not found",
          };
        }
        socialAccount = fetchedAccount;
      }

      if (!socialAccount.is_active) {
        const errorMsg =
          "LinkedIn account has been disconnected. Please reconnect your account.";
        await this.markPostAsFailed(postId, errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      if (socialAccount.platform !== "linkedin") {
        const errorMsg = `Unsupported platform: ${socialAccount.platform}`;
        await this.markPostAsFailed(postId, errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      if (!socialAccount.access_token) {
        const errorMsg =
          "LinkedIn access token is missing. Please reconnect your account.";
        await this.markPostAsFailed(postId, errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const tokenExpiry = new Date(socialAccount.token_expires_at);
      const now = new Date();
      if (tokenExpiry <= now) {
        const errorMsg =
          "LinkedIn access token has expired. Please reconnect your account.";
        await this.markPostAsFailed(postId, errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      let imageUrns: string[] = [];
      if (generatedPost.media_urls && generatedPost.media_urls.length > 0) {
        imageUrns = await this.uploadImagesToLinkedIn(
          generatedPost.media_urls,
          socialAccount.access_token,
          socialAccount.account_id
        );
      }

      const result = await this.makeLinkedInPost(
        generatedPost.content,
        socialAccount.access_token,
        socialAccount.account_id,
        imageUrns
      );

      if (result.success && result.postId) {
        await this.markPostAsPublished(postId, result.postId);
        return {
          success: true,
          postId: result.postId,
        };
      } else {
        const isAuthError =
          result.error?.includes("Auth failed") ||
          result.error?.includes("401") ||
          result.error?.includes("403");

        if (isAuthError) {
          await supabase
            .from("social_accounts")
            .update({ is_active: false })
            .eq("id", socialAccountId);

          const errorMsg =
            "LinkedIn authentication failed. Your account may have been disconnected. Please reconnect.";
          await this.markPostAsFailed(postId, errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }

        await this.incrementRetryCount(postId, result.error || "Unknown error");
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

      await this.incrementRetryCount(postId, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async uploadImagesToLinkedIn(
    s3Urls: string[],
    accessToken: string,
    personUrn: string
  ): Promise<string[]> {
    const imageUrns: string[] = [];

    for (const s3Url of s3Urls) {
      try {
        const imageResponse = await fetch(s3Url);
        if (!imageResponse.ok) {
          logger.warn(`Failed to download image from S3: ${s3Url}`);
          continue;
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const mimeType = this.getMimeTypeFromUrl(s3Url) || "image/jpeg";

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

        const registerData: any = await registerResponse.json();
        const uploadUrl =
          registerData.value.uploadMechanism[
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
          ].uploadUrl;
        const assetUrn = registerData.value.asset;

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
        logger.error(`Error uploading image ${s3Url}:`, error.message);
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
            error: `Auth failed (${response.status}): Token invalid or revoked`,
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

      const data: any = await response.json();

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

  private getMimeTypeFromUrl(url: string): string {
    const ext = url.split(".").pop()?.toLowerCase().split("?")[0];
    const mimeTypes: { [key: string]: string } = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    return mimeTypes[ext || ""] || "image/jpeg";
  }

  // Fixed markPostAsPublished function
private async markPostAsPublished(
  postId: string,
  linkedinPostId: string
): Promise<void> {
  try {
    // First, get the scheduled post with generated post info
    const { data: scheduledPost, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("post_id")
      .eq("id", postId)
      .single();

    if (fetchError || !scheduledPost) {
      logger.error("Error fetching scheduled post:", fetchError);
      return;
    }

    // Then fetch the generated post separately to ensure we get user_id and platform
    const { data: generatedPost, error: genPostError } = await supabase
      .from("generated_posts")
      .select("user_id, platform")
      .eq("id", scheduledPost.post_id)
      .single();

    if (genPostError || !generatedPost) {
      logger.error("Error fetching generated post:", genPostError);
    } else {
      // ✅ Now we have reliable user_id and platform
      const { user_id, platform } = generatedPost;
      
      console.log("🔥 Incrementing usage for:", { user_id, platform, postId });
      
      // Increment both weekly and daily counters
      await incrementUsage({ 
        type: "published_post", 
        userId: user_id, 
        platform 
      });
      
      console.log("✅ Usage incremented successfully");
    }

    // Update the scheduled post status
    const { error: updateError } = await supabase
      .from("scheduled_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_post_id: linkedinPostId,
        retry_count: 0,
        error_message: null,
      })
      .eq("id", postId);

    if (updateError) {
      logger.error("Error updating scheduled post:", updateError);
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
      }
    } catch (error) {
      logger.error("Error in markPostAsFailed:", error);
    }
  }

  private async incrementRetryCount(
    postId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const { data: currentPost, error: fetchError } = await supabase
        .from("scheduled_posts")
        .select("retry_count")
        .eq("id", postId)
        .single();

      if (fetchError || !currentPost) {
        logger.error("Error fetching post for retry:", fetchError);
        return;
      }

      const newRetryCount = (currentPost.retry_count || 0) + 1;

      if (newRetryCount >= MAX_RETRIES) {
        await this.markPostAsFailed(
          postId,
          `Max retries (${MAX_RETRIES}) reached. Last error: ${errorMessage}`
        );
        return;
      }

      const { error } = await supabase
        .from("scheduled_posts")
        .update({
          retry_count: newRetryCount,
          error_message: `Retry ${newRetryCount}/${MAX_RETRIES}: ${errorMessage}`,
        })
        .eq("id", postId);

      if (error) {
        logger.error("Error incrementing retry count:", error);
      }
    } catch (error) {
      logger.error("Error in incrementRetryCount:", error);
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

      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      const { data: generatedPost, error: postError } = await supabase
        .from("generated_posts")
        .select("id, content, media_urls, platform, workspace_id, user_id")
        .eq("id", postId)
        .single();

      if (postError || !generatedPost) {
        res.status(404).json({
          success: false,
          error: "Generated post not found",
        });
        return;
      }

      // CHECK WEEKLY LIMIT
      const weeklyLimitCheck = await checkWeeklyPostLimit(
        generatedPost.user_id
      );

      if (!weeklyLimitCheck.canPost) {
        res.status(400).json({
          success: false,
          error: weeklyLimitCheck.message || "Weekly posting limit exceeded",
        });
        return;
      }

      // CHECK DAILY LIMIT
      const dailyLimitCheck = await checkDailyPostLimit(generatedPost.user_id);
      if (!dailyLimitCheck.canPostToday) {
        res.status(400).json({
          success: false,
          error: dailyLimitCheck.message || "Daily posting limit exceeded",
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
          error:
            "LinkedIn account has been disconnected. Please reconnect your account.",
        });
        return;
      }

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
      // For publishNow we schedule for immediate posting (now)
      const scheduledTime = new Date().toISOString();
      const scheduledPostData = {
        workspace_id: generatedPost.workspace_id,
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
          scheduledPost.generated_posts?.[0]?.platform ||
          generatedPost.platform,
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

      // publish immediately using the same flow as scheduler
      const result = await this.publishToLinkedIn(flatPost);

      if (result.success) {
        // markPostAsPublished already increments weekly/daily/published counters,
        // so we DO NOT increment again here to avoid double counting.
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
