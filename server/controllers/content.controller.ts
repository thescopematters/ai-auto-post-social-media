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
    console.log(">>>>>>data>>>>", req)

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
      .select("*, documents(title), profiles!generated_posts_user_id_fkey(full_name, email)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("generated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("moderation_status", status);
    if (platform) query = query.eq("platform", platform);

    const { data, error, count } = await query;

    if (error) throw new Error("Failed to fetch posts");

    paginatedResponse(res, data || [], page, limit, count || 0, "Posts retrieved successfully");
  } catch (error) {
    next(error);
  }
};

// Get post by ID
export const getPostById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .select("*, documents(title)")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) throw new NotFoundError("Post not found");

    successResponse(res, data, "Post retrieved successfully");
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

    if (error) throw new NotFoundError("Post not found");

    successResponse(res, null, "Post deleted successfully");
  } catch (error) {
    next(error);
  }
};

// Moderate post
export const moderatePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, postId } = req.params;
    const { action, reason } = req.body;
    if (!req.user) throw new Error("User not authenticated");

    const { data: post } = await supabaseAdmin
      .from("generated_posts")
      .select("moderation_status")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!post) throw new NotFoundError("Post not found");

    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged";

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .update({
        moderation_status: newStatus,
        moderation_notes: reason,
        moderated_by: req.user.id,
        moderated_at: new Date().toISOString(),
      } as any)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw new Error("Failed to moderate post");

    await supabaseAdmin.from("moderation_logs").insert({
      post_id: postId,
      user_id: req.user.id,
      action,
      reason,
      previous_status: post.moderation_status,
      new_status: newStatus,
    } as any);

    successResponse(res, data, "Post moderated successfully");
  } catch (error) {
    next(error);
  }
};

// Schedule post with free user limits
export const schedulePost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const { postId, socialAccountId, scheduledTime } = req.body;
    if (!req.user) throw new Error("User not authenticated");

    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id, platform")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) throw new NotFoundError("Post not found");

    // Check limits BEFORE allowing the action
    const dailyLimitCheck = await checkDailyPostLimit(req.user.id);
    if (!dailyLimitCheck.canPostToday) throw new Error(dailyLimitCheck.message);

    const weeklyLimitCheck = await checkWeeklyPostLimit(req.user.id);
    if (!weeklyLimitCheck.canPost) throw new Error(weeklyLimitCheck.message);

    // Create scheduled post
    const { data, error } = await supabaseAdmin
      .from("scheduled_posts")
      .insert({
        post_id: postId,
        workspace_id: workspaceId,
        social_account_id: socialAccountId,
        scheduled_time: scheduledTime,
        status: "scheduled",
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to schedule post: ${error.message}`);

    // Update post status
    await supabaseAdmin.from("generated_posts").update({ moderation_status: "scheduled" }).eq("id", postId);

    // ✅ FIX: Use incrementUsage with correct types
    await incrementUsage({
      type: "weekly_post",
      userId: req.user.id,
      platform: post.platform,
      scheduledTimeISO: scheduledTime
    });

    successResponse(res, data, "Post scheduled successfully", 201);
  } catch (error) {
    next(error);
  }
};