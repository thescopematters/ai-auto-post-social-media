// @ts-nocheck
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import supabaseAdmin from '../config/database';
import { NotFoundError } from '../utils/errors';
import { successResponse, paginatedResponse } from '../utils/response';
import logger from '../config/logger';

const generateMockContent = (platform: string, tone: string): string[] => {
  const templates = {
    linkedin: [
      `🚀 Excited to share some insights from our latest research!\n\nWe've discovered that companies leveraging AI automation see a 40% increase in productivity. This isn't just about efficiency – it's about empowering teams to focus on strategic work that drives real value.\n\nWhat's your experience with AI in the workplace?\n\n#AI #Productivity #Innovation`,
      `Just analyzed the latest trends in B2B marketing. The results might surprise you 📊\n\nKey takeaways:\n✅ Authentic content wins\n✅ Engagement over reach\n✅ Value-first approach\n\nWant to learn more? Drop a comment below!\n\n#Marketing #Strategy`,
      `💡 Hot take: The future of content creation is here.\n\nAI isn't replacing creativity – it's amplifying it. Teams using smart automation tools are producing 3x more content while maintaining quality.\n\nThe question isn't whether to adopt AI, but how fast you can integrate it.\n\n#ContentMarketing #DigitalTransformation`,
    ],
    twitter: [
      `🔥 AI automation is changing the game. 40% productivity boost for companies that embrace it.\n\nNot replacing humans, just making us better at what we do.\n\n#AI #Productivity`,
      `Latest B2B marketing trends:\n\n✅ Authentic beats perfect\n✅ Engagement > Reach  \n✅ Value first, always\n\nWhat are you seeing in your space?\n\n#Marketing`,
      `Hot take: AI won't replace creators.\n\nIt'll just separate those who adapt from those who don't.\n\nTeams using AI tools = 3x more content, same quality.\n\n#ContentMarketing`,
    ],
  };

  return templates[platform as keyof typeof templates] || templates.linkedin;
};

export const generateContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { documentId, platform, tone, agentConfigId, variantCount } = req.body;

    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('content_text')
      .eq('id', documentId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const mockPosts = generateMockContent(platform, tone);
    const posts = mockPosts.slice(0, variantCount || 3);

    const generatedPosts: any[] = [];

    for (let i = 0; i < posts.length; i++) {
      const { data, error } = await supabaseAdmin
        .from('generated_posts')
        .insert({
          workspace_id: workspaceId,
          document_id: documentId,
          agent_config_id: agentConfigId,
          platform,
          content: posts[i],
          variant_number: i + 1,
          hashtags: [],
          media_urls: [],
          predicted_score: Math.random() * 10,
          moderation_status: 'pending',
        })
        .select()
        .single();

      if (!error && data) {
        generatedPosts.push(data as any);
      }
    }

    logger.info(`Generated ${generatedPosts.length} posts for document ${documentId}`);

    successResponse(res, generatedPosts, 'Content generated successfully', 201);
  } catch (error) {
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
