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
  checkPostGenerationLimit,
  checkDailyPostLimit,
  checkAIGenerationLimit
} from "../utils/limitCheck";

export const generateContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const {
      documentId,
      platform,
      tone,
      framework,
      agentConfigId,
      variantCount = 1,
    } = req.body;

    if (!req.user) {
      throw new Error("User not authenticated");
    }

    const userId = req.user.id;

    const requestedVariants = 1;

    if (variantCount > 1) {
      throw new Error(
        "Only 1 variant can be generated at a time. Please generate one post at a time."
      );
    }

    const aiLimitCheck = await checkAIGenerationLimit(workspaceId, userId);
    if (!aiLimitCheck.canGenerate) {
      throw new Error(aiLimitCheck.message || "AI generation limit exceeded");
    }

    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("content_text, title")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (docError || !document) {
      console.error("Document fetch error:", docError);
      throw new NotFoundError("Document not found");
    }

    if (!document.content_text) {
      throw new Error("Document has no content to generate posts from");
    }

    // Generate posts from Gemini
    const generatedContent = await geminiService.generateWithRetry(
      document.content_text,
      platform as "linkedin" | "twitter",
      tone,
      requestedVariants, // Use the checked variant count
      2,
      framework
    );

    if (!generatedContent || generatedContent.length === 0) {
      throw new Error("Failed to generate posts from AI service");
    }

    // Prepare all inserts
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

    // Insert all posts at once
    const { data: savedPosts, error: insertError } = await supabaseAdmin
      .from("generated_posts")
      .insert(postsToInsert)
      .select();

    if (insertError) {
      console.error("❌ Insert error:", insertError.message);
      throw new Error(`Failed to save posts: ${insertError.message}`);
    }

    if (!savedPosts || savedPosts.length === 0) {
      throw new Error("No posts were saved to database");
    }

    const updatedAILimitCheck = await checkAIGenerationLimit(
      workspaceId,
      userId
    );

    successResponse(
      res,
      {
        posts: savedPosts,
        limits: {
          remainingAIGenerations: updatedAILimitCheck.remaining,
          totalAIGenerations: updatedAILimitCheck.limit,
          currentUsage: updatedAILimitCheck.currentUsage,
          planType: updatedAILimitCheck.planType,
        },
      },
      "Content generated successfully",
      201
    );
  } catch (error: any) {
    console.error("❌ Error in generateContent:", error.message);
    logger.error("Generation error:", error.message);
    next(error);
  }
};

export const uploadPostImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new Error("No image file provided");
    }

    const { workspaceId, postId } = req.params;
    const userId = req.user.id;

    // Verify post exists and user has access
    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id, workspace_id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      throw new NotFoundError("Post not found");
    }

    // Upload image to Supabase Storage
    const file = req.file;
    const fileName = `posts/${workspaceId}/${postId}/${Date.now()}-${
      file.originalname
    }`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("post-images")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("post-images").getPublicUrl(fileName);

    // Update post with image info
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from("generated_posts")
      .update({
        media_urls: [publicUrl],
      })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError) {
      throw new Error(
        `Failed to update post with image: ${updateError.message}`
      );
    }

    successResponse(
      res,
      {
        post: updatedPost,
        imageUrl: publicUrl,
        fileName: fileName,
      },
      "Image uploaded successfully",
      200
    );
  } catch (error: any) {
    console.error("❌ Image upload error:", error.message);
    next(error);
  }
};

export const updatePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;
    const { content, hashtags, mediaUrls, removeImage } = req.body;

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

    if (error || !data) {
      throw new NotFoundError("Post not found");
    }
    successResponse(res, data, "Post updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removePostImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;

    // Get current post to find image filename
    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      throw new NotFoundError("Post not found");
    }

    // Update post to remove image references
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from("generated_posts")
      .update({
        media_urls: [],
      })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to remove image: ${updateError.message}`);
    }

    successResponse(res, updatedPost, "Image removed successfully", 200);
  } catch (error: any) {
    console.error("❌ Remove image error:", error.message);
    next(error);
  }
};

export const getAllPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const platform = req.query.platform as string;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("generated_posts")
      .select(
        "*, documents(title), profiles!generated_posts_user_id_fkey(full_name, email)",
        {
          count: "exact",
        }
      )
      .eq("workspace_id", workspaceId)
      .order("generated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("moderation_status", status);
    }

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error("Failed to fetch posts");
    }

    paginatedResponse(
      res,
      data || [],
      page,
      limit,
      count || 0,
      "Posts retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const getPostById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("generated_posts")
      .select("*, documents(title)")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Post not found");
    }

    successResponse(res, data, "Post retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;

    const { error } = await supabaseAdmin
      .from("generated_posts")
      .delete()
      .eq("id", postId)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new NotFoundError("Post not found");
    }

    successResponse(res, null, "Post deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const moderatePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;
    const { action, reason } = req.body;

    if (!req.user) {
      throw new Error("User not authenticated");
    }

    const { data: post } = await supabaseAdmin
      .from("generated_posts")
      .select("moderation_status")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    const newStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
        ? "rejected"
        : "flagged";

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

    if (error) {
      throw new Error("Failed to moderate post");
    }

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

export const schedulePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { postId, socialAccountId, scheduledTime } = req.body;

    if (!req.user) {
      throw new Error("User not authenticated");
    }

    // Verify post exists and belongs to workspace
    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      throw new NotFoundError("Post not found");
    }

    const weeklyLimitCheck = await checkWeeklyPostLimit(
      workspaceId,
      req.user.id
    );
    if (!weeklyLimitCheck.canPost) {
      throw new Error(
        weeklyLimitCheck.message || "Weekly posting limit exceeded"
      );
    }

    // Create scheduled post record
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

    if (error) {
      throw new Error(`Failed to schedule post: ${error.message}`);
    }

    // Update post status
    await supabaseAdmin
      .from("generated_posts")
      .update({ moderation_status: "scheduled" })
      .eq("id", postId);

    successResponse(res, data, "Post scheduled successfully", 201);
  } catch (error) {
    next(error);
  }
};
