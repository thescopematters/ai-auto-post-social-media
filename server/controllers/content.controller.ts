// @ts-nocheck
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import supabaseAdmin from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { successResponse, paginatedResponse } from '../utils/response';
import logger from '../config/logger';
import { generatePostsWithGemini } from '../services/gemini.service';

export const generateContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { documentId, platform, tone, agentConfigId, variantCount = 10 } = req.body;

    if (!req.user) {
      throw new Error('User not authenticated');
    }

    if (!documentId || !platform || !tone) {
      throw new ValidationError('Missing required fields: documentId, platform, or tone');
    }

    if (!['linkedin', 'twitter'].includes(platform)) {
      throw new ValidationError('Invalid platform. Must be "linkedin" or "twitter"');
    }

    if (!['professional', 'casual', 'thought_leader', 'educational', 'promotional'].includes(tone)) {
      throw new ValidationError('Invalid tone');
    }

    if (variantCount < 1 || variantCount > 20) {
      throw new ValidationError('variantCount must be between 1 and 20');
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('content_text, title')
      .eq('id', documentId)
      .eq('workspace_id', workspaceId)
      .single();

    if (docError || !document) {
      throw new NotFoundError('Document not found or access denied');
    }

    if (!document.content_text) {
      throw new ValidationError('Document has no content to generate posts from');
    }

    logger.info(`Starting post generation for document ${documentId}`, {
      workspaceId,
      platform,
      tone,
      variantCount,
      userId: req.user.id,
    });

    const aiGeneratedPosts = await generatePostsWithGemini({
      documentContent: document.content_text,
      platform,
      tone,
      variantCount,
    });

    if (!aiGeneratedPosts || aiGeneratedPosts.length === 0) {
      throw new Error('AI service failed to generate posts');
    }

    const generatedPosts: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < aiGeneratedPosts.length; i++) {
      const post = aiGeneratedPosts[i];

      try {
        const { data, error } = await supabaseAdmin
          .from('generated_posts')
          .insert({
            workspace_id: workspaceId,
            document_id: documentId,
            agent_config_id: agentConfigId || null,
            platform,
            content: post.content,
            tone,
            variant_number: i + 1,
            hashtags: post.hashtags || [],
            media_urls: [],
            predicted_score: Math.random() * 10,
            moderation_status: 'pending',
          })
          .select()
          .single();

        if (error) {
          logger.error(`Failed to save post ${i + 1}`, { error });
          errors.push({ index: i + 1, error: error.message });
        } else if (data) {
          generatedPosts.push(data);
        }
      } catch (insertError: any) {
        logger.error(`Exception saving post ${i + 1}`, { error: insertError });
        errors.push({ index: i + 1, error: insertError.message });
      }
    }

    logger.info(`Successfully generated ${generatedPosts.length} posts for document ${documentId}`, {
      requested: variantCount,
      successful: generatedPosts.length,
      failed: errors.length,
    });

    if (generatedPosts.length === 0) {
      throw new Error('Failed to save any generated posts to database');
    }

    successResponse(
      res,
      {
        posts: generatedPosts,
        metadata: {
          requested: variantCount,
          generated: aiGeneratedPosts.length,
          saved: generatedPosts.length,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      'Content generated successfully',
      201
    );
  } catch (error: any) {
    logger.error('Content generation failed', {
      error: error.message,
      stack: error.stack,
    });
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
      .from('generated_posts')
      .select('*, documents(title)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('moderation_status', status);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error('Failed to fetch posts');
    }

    paginatedResponse(res, data || [], page, limit, count || 0, 'Posts retrieved successfully');
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
      .from('generated_posts')
      .select('*, documents(title)')
      .eq('id', postId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Post not found');
    }

    successResponse(res, data, 'Post retrieved successfully');
  } catch (error) {
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
    const { content, hashtags, mediaUrls } = req.body;

    const updateData: any = {};
    if (content) updateData.content = content;
    if (hashtags) updateData.hashtags = hashtags;
    if (mediaUrls) updateData.media_urls = mediaUrls;

    const { data, error } = await supabaseAdmin
      .from('generated_posts')
      .update(updateData)
      .eq('id', postId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Post not found');
    }

    successResponse(res, data, 'Post updated successfully');
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
      .from('generated_posts')
      .delete()
      .eq('id', postId)
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new NotFoundError('Post not found');
    }

    logger.info(`Post deleted: ${postId}`);

    successResponse(res, null, 'Post deleted successfully');
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
      throw new Error('User not authenticated');
    }

    const { data: post } = await supabaseAdmin
      .from('generated_posts')
      .select('moderation_status')
      .eq('id', postId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged';

    const { data, error } = await supabaseAdmin
      .from('generated_posts')
      .update({
        moderation_status: newStatus,
        moderation_notes: reason,
        moderated_by: req.user.id,
        moderated_at: new Date().toISOString(),
      } as any)
      .eq('id', postId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to moderate post');
    }

    await supabaseAdmin.from('moderation_logs').insert({
      post_id: postId,
      user_id: req.user.id,
      action,
      reason,
      previous_status: post.moderation_status,
      new_status: newStatus,
      } as any);

    logger.info(`Post ${postId} moderated: ${action} by ${req.user.email}`);

    successResponse(res, data, 'Post moderated successfully');
  } catch (error) {
    next(error);
  }
};
