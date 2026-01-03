// @ts-nocheck
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError } from "../utils/errors";
import { successResponse, paginatedResponse } from "../utils/response";
import logger from "../config/logger";
import geminiService from "../services/gemini.service";
import { uploadToSupabaseStorage } from "../utils/fileUpload";
import {
  checkAIGenerationLimit,
  checkDailyPostLimit,
  checkWeeklyPostLimit,
  incrementUsage,
} from "../utils/limitCheck";

// Generate AI post
export const generateContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { documentId, platform, tone, framework, agentConfigId, variantCount = 1 } = req.body;

    if (!req.user) throw new Error("User not authenticated");
    const userId = req.user.id;

    if (variantCount > 1)
      throw new Error("Free users can only generate 1 post at a time.");

    // Check AI generation limit (daily)
    const aiLimit = await checkAIGenerationLimit(userId);
    if (!aiLimit.canGenerate) throw new Error(aiLimit.message || "AI generation limit reached");

    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("content_text, title")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (docError || !document) throw new NotFoundError("Document not found");
    if (!document.content_text) throw new Error("Document has no content to generate posts from");

    // Generate content via AI
    const generatedContent = await geminiService.generateWithRetry(
      document.content_text,
      platform as "linkedin" | "twitter",
      tone,
      1,
      2,
      framework
    );

    if (!generatedContent || generatedContent.length === 0)
      throw new Error("Failed to generate posts from AI service");

    // Prepare posts
    const postsToInsert = generatedContent.map((content, index) => ({
      workspace_id: workspaceId,
      user_id: userId,
      document_id: documentId,
      agent_config_id: agentConfigId || null,
      platform,
      content,
      variant_number: index + 1,
      framework: framework || "auto",
      hashtags: [],
      media_urls: [],
      predicted_score: Math.random() * 10,
      moderation_status: "pending",
      status: "pending",
    }));

    const { data: savedPosts, error: insertError } = await supabaseAdmin
      .from("generated_posts")
      .insert(postsToInsert)
      .select();

    if (insertError) throw new Error(`Failed to save posts: ${insertError.message}`);

    // ✅ FIX: Changed from "ai_generation" to "ai"
    await incrementUsage({ userId, type: "ai", platform });

    const updatedLimit = await checkAIGenerationLimit(userId);

    successResponse(
      res,
      {
        posts: savedPosts,
        limits: {
          remainingAIGenerations: updatedLimit.remaining,
          totalAIGenerations: updatedLimit.limit,
          currentUsage: updatedLimit.currentUsage,
          planType: updatedLimit.planType,
        },
      },
      "Content generated successfully",
      201
    );
  } catch (error: any) {
    logger.error("❌ generateContent error:", error.message);
    next(error);
  }
};

// Moderate a post
export const moderatePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    const { action, reason } = req.body;
    const userId = req.user.id;

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      flag: "flagged",
    };

    const newStatus = statusMap[action] || "pending";

    const updates: any = {
      status: newStatus,
      moderation_status: newStatus,
      moderated_by: userId,
      moderated_at: new Date().toISOString(),
    };

    if (reason) {
      updates.moderation_notes = reason;
    }

    const { data: post, error } = await supabaseAdmin
      .from("generated_posts")
      .update(updates)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to moderate post: ${error.message}`);

    successResponse(res, post, "Post moderated successfully");
  } catch (error) {
    next(error);
  }
};

// Upload image to a post
export const uploadPostImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new Error("No image file provided");

    const { workspaceId, postId } = req.params;
    const userId = req.user.id;

    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) throw new NotFoundError("Post not found");

    const fileName = `posts/${workspaceId}/${postId}/${Date.now()}-${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("post-images")
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = supabaseAdmin.storage.from("post-images").getPublicUrl(fileName);

    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from("generated_posts")
      .update({ media_urls: [publicUrlData.publicUrl] })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update post with image: ${updateError.message}`);

    successResponse(res, { post: updatedPost, imageUrl: publicUrlData.publicUrl }, "Image uploaded successfully");
  } catch (error: any) {
    logger.error("❌ uploadPostImage error:", error.message);
    next(error);
  }
};

// Remove image from a post
export const removePostImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;

    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("*")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) throw new NotFoundError("Post not found");

    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from("generated_posts")
      .update({ media_urls: [] })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to remove image: ${updateError.message}`);

    successResponse(res, updatedPost, "Image removed successfully");
  } catch (error: any) {
    logger.error("❌ removePostImage error:", error.message);
    next(error);
  }
};

// Update post content/hashtags/media
export const updatePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    const { content, hashtags, mediaUrls } = req.body;

    const updateData: any = {};
    if (content) updateData.content = content;
    if (hashtags) updateData.hashtags = hashtags;
    if (mediaUrls) updateData.media_urls = mediaUrls;

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .update(updateData)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError("Post not found");

    successResponse(res, data, "Post updated successfully");
  } catch (error) {
    next(error);
  }
};

// Get all posts
export const getAllPosts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const platform = req.query.platform as string;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("generated_posts")
      .select("*, documents(title), profiles(full_name, email)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("generated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Support multiple statuses (e.g. "scheduled,draft")
    if (status) {
      const statuses = status.split(",");
      if (statuses.length > 1) {
        query = query.in("status", statuses);
      } else {
        query = query.eq("status", status);
      }
    }

    if (platform) query = query.eq("platform", platform);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch posts: ${error.message}`);

    paginatedResponse(res, data, page, limit, count || 0);
  } catch (error) {
    next(error);
  }
};

// Publish a post immediately
export const publishPost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    const { socialAccountId } = req.body;

    // Use scheduler controller to handle immediate publishing
    req.body.postId = postId;
    req.body.socialAccountId = socialAccountId;

    // We import schedulerController dynamically or assume it's available
    const { schedulerController } = require("./scheduler.controller");
    await schedulerController.publishNow(req, res);
  } catch (error) {
    next(error);
  }
};

// Get post by ID
export const getPostById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;

    const { data: post, error } = await supabaseAdmin
      .from("generated_posts")
      .select("*, documents(title)")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !post) throw new NotFoundError("Post not found");

    successResponse(res, post, "Post fetched successfully");
  } catch (error) {
    next(error);
  }
};

// Delete post
export const deletePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;

    const { error } = await supabaseAdmin
      .from("generated_posts")
      .delete()
      .eq("id", postId)
      .eq("workspace_id", workspaceId);

    if (error) throw new Error(`Failed to delete post: ${error.message}`);

    successResponse(res, null, "Post deleted successfully");
  } catch (error) {
    next(error);
  }
};

// Schedule a post
export const schedulePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    const { scheduledTime } = req.body;
    const userId = req.user.id;

    if (!scheduledTime) throw new Error("Scheduled time is required");

    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("platform")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) throw new NotFoundError("Post not found");

    // Check weekly post limit
    const weeklyLimit = await checkWeeklyPostLimit(userId);
    if (!weeklyLimit.canPost) throw new Error(weeklyLimit.message || "Weekly post limit reached");

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .update({ status: "scheduled", scheduled_at: scheduledTime })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to schedule post: ${error.message}`);

    // Increment usage
    await incrementUsage({
      userId,
      type: "weekly_post",
      platform: post.platform,
      scheduledTimeISO: scheduledTime,
    });

    successResponse(res, data, "Post scheduled successfully");
  } catch (error) {
    next(error);
  }
};

export const draft_post = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    if (!req.user) throw new Error("User not authenticated");

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .update({ status: "draft" })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw new Error("Failed to draft post");

    successResponse(res, data, "Post drafted successfully");
  } catch (error) {
    next(error);
  }
};


