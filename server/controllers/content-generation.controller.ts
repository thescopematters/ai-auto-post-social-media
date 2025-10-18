import { Request, Response } from 'express';
import { GeminiService } from '../services/gemini.service';
import supabaseAdmin from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export class ContentGenerationController {
  static async generateContent(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { documentId, platform, tone = 'professional', style = 'engaging', variantCount = 3 } = req.body;

      // Validate input
      if (!documentId || !platform) {
        return errorResponse(res, 'Document ID and platform are required', 400);
      }

      if (!['linkedin', 'twitter'].includes(platform)) {
        return errorResponse(res, 'Platform must be either linkedin or twitter', 400);
      }

      // Get document content
      const { data: document, error: docError } = await (supabaseAdmin as any)
        .from('documents')
        .select('content_text, title')
        .eq('id', documentId)
        .eq('workspace_id', workspaceId)
        .single();

      if (docError || !document) {
        return errorResponse(res, 'Document not found', 404);
      }

      if (!document.content_text) {
        return errorResponse(res, 'Document has no content to generate from', 400);
      }

      // Check subscription limits
      const canGenerate = await ContentGenerationController.checkGenerationLimits(workspaceId);
      if (!canGenerate) {
        return errorResponse(
          res,
          'AI generation limit reached for your subscription plan',
          403
        );
      }

      // Generate content using Gemini AI
      const variants = await GeminiService.generateContent({
        documentContent: document.content_text,
        platform: platform as 'linkedin' | 'twitter',
        tone,
        style,
        variantCount: Math.min(variantCount, 5), // Max 5 variants
      });

      // Store generated posts in database
      const posts = [];
      for (let i = 0; i < variants.length; i++) {
        const { data: post, error } = await (supabaseAdmin as any)
          .from('generated_posts')
          .insert({
            workspace_id: workspaceId,
            document_id: documentId,
            platform,
            content: variants[i],
            tone,
            variant_number: i + 1,
            moderation_status: 'pending',
            generated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && post) {
          posts.push(post);
        }
      }

      return successResponse(
        res,
        { posts, count: posts.length },
        'Content generated successfully'
      );
    } catch (error) {
      console.error('Content generation error:', error);
      return errorResponse(
        res,
        error instanceof Error ? error.message : 'Failed to generate content',
        500
      );
    }
  }

  static async improveContent(req: Request, res: Response) {
    try {
      const { workspaceId, postId } = req.params;
      const { suggestions, platform } = req.body;

      if (!suggestions) {
        return errorResponse(res, 'Suggestions are required', 400);
      }

      // Get existing post
      const { data: post, error: postError } = await (supabaseAdmin as any)
        .from('generated_posts')
        .select('content, platform')
        .eq('id', postId)
        .eq('workspace_id', workspaceId)
        .single();

      if (postError || !post) {
        return errorResponse(res, 'Post not found', 404);
      }

      // Improve content
      const improvedContent = await GeminiService.improveContent(
        post.content,
        platform || post.platform,
        suggestions
      );

      // Create new variant with improved content
      const { data: newPost, error } = await (supabaseAdmin as any)
        .from('generated_posts')
        .insert({
          workspace_id: workspaceId,
          document_id: post.document_id,
          platform: post.platform,
          content: improvedContent,
          parent_post_id: postId,
          moderation_status: 'pending',
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return successResponse(res, newPost, 'Content improved successfully');
    } catch (error) {
      console.error('Content improvement error:', error);
      return errorResponse(res, 'Failed to improve content', 500);
    }
  }

  static async getAllPosts(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { page = 1, limit = 20, status, platform } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = (supabaseAdmin as any)
        .from('generated_posts')
        .select('*, documents(title)', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('generated_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (status) {
        query = query.eq('moderation_status', status);
      }

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: posts, error, count } = await query;

      if (error) {
        throw error;
      }

      const totalPages = Math.ceil((count || 0) / limitNum);

      return successResponse(
        res,
        posts,
        'Posts retrieved successfully',
        200,
        {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages,
        }
      );
    } catch (error) {
      console.error('Get posts error:', error);
      return errorResponse(res, 'Failed to retrieve posts', 500);
    }
  }

  static async getPost(req: Request, res: Response) {
    try {
      const { workspaceId, postId } = req.params;

      const { data: post, error } = await (supabaseAdmin as any)
        .from('generated_posts')
        .select('*, documents(title, file_type)')
        .eq('id', postId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error || !post) {
        return errorResponse(res, 'Post not found', 404);
      }

      return successResponse(res, post, 'Post retrieved successfully');
    } catch (error) {
      console.error('Get post error:', error);
      return errorResponse(res, 'Failed to retrieve post', 500);
    }
  }

  static async updatePost(req: Request, res: Response) {
    try {
      const { workspaceId, postId } = req.params;
      const { content, moderation_status } = req.body;

      const updates: any = {};
      if (content !== undefined) updates.content = content;
      if (moderation_status) updates.moderation_status = moderation_status;
      updates.updated_at = new Date().toISOString();

      const { data: post, error } = await (supabaseAdmin as any)
        .from('generated_posts')
        .update(updates)
        .eq('id', postId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error || !post) {
        return errorResponse(res, 'Post not found', 404);
      }

      return successResponse(res, post, 'Post updated successfully');
    } catch (error) {
      console.error('Update post error:', error);
      return errorResponse(res, 'Failed to update post', 500);
    }
  }

  static async deletePost(req: Request, res: Response) {
    try {
      const { workspaceId, postId } = req.params;

      const { error } = await (supabaseAdmin as any)
        .from('generated_posts')
        .delete()
        .eq('id', postId)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      return successResponse(res, null, 'Post deleted successfully');
    } catch (error) {
      console.error('Delete post error:', error);
      return errorResponse(res, 'Failed to delete post', 500);
    }
  }

  static async moderatePost(req: Request, res: Response) {
    try {
      const { workspaceId, postId } = req.params;
      const { action, reason } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return errorResponse(res, 'Action must be either approve or reject', 400);
      }

      const status = action === 'approve' ? 'approved' : 'rejected';

      const { data: post, error } = await (supabaseAdmin as any)
        .from('generated_posts')
        .update({
          moderation_status: status,
          moderation_notes: reason,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error || !post) {
        return errorResponse(res, 'Post not found', 404);
      }

      return successResponse(res, post, `Post ${action}d successfully`);
    } catch (error) {
      console.error('Moderate post error:', error);
      return errorResponse(res, 'Failed to moderate post', 500);
    }
  }

  private static async checkGenerationLimits(workspaceId: string): Promise<boolean> {
    try {
      // Get workspace subscription
      const { data: subscription, error } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('tier, usage_limits')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single();

      if (error || !subscription) {
        return false; // No active subscription
      }

      const limits = subscription.usage_limits as any;

      // Check if unlimited
      if (limits?.ai_generations === -1) {
        return true;
      }

      // Count generations this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error: countError } = await (supabaseAdmin as any)
        .from('generated_posts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('generated_at', startOfMonth.toISOString());

      if (countError) {
        return false;
      }

      return (count || 0) < (limits?.ai_generations || 10);
    } catch (error) {
      console.error('Error checking generation limits:', error);
      return false;
    }
  }
}
