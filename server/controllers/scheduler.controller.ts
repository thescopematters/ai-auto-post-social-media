// controllers/scheduler.controller.ts
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class SchedulerController {
  private isRunning = false;

  startScheduler() {
    console.log('🚀 Starting LinkedIn auto-posting scheduler...');
    
    // Run every minute
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) return;
      
      this.isRunning = true;
      try {
        await this.processScheduledPosts();
      } catch (error) {
        console.error('Scheduler error:', error);
      } finally {
        this.isRunning = false;
      }
    });
  }

  private async processScheduledPosts() {
    const now = new Date();
    console.log(`⏰ Checking scheduled posts at ${now.toISOString()}`);

    // Get posts that are due for publishing
    const { data: scheduledPosts, error } = await supabase
      .from('scheduled_posts')
      .select(`
        id,
        scheduled_time,
        workspace_id,
        post:generated_posts(
          content,
          platform,
          media_urls
        )
      `)
      .lte('scheduled_time', now.toISOString())
      .eq('status', 'scheduled')
      .eq('post.platform', 'linkedin');

    if (error) {
      console.error('Error fetching scheduled posts:', error);
      return;
    }

    console.log(`📝 Found ${scheduledPosts?.length || 0} LinkedIn posts to publish`);

    for (const scheduledPost of scheduledPosts || []) {
      await this.publishToLinkedIn(scheduledPost);
    }
  }

  private async publishToLinkedIn(scheduledPost: any) {
    try {
      console.log(`📤 Publishing LinkedIn post ${scheduledPost.id}...`);
      
      const post = scheduledPost.post;
      
      // Get LinkedIn access token for this workspace
      const { data: linkedinAccount, error: accountError } = await supabase
        .from('social_accounts')
        .select('access_token, account_id')
        .eq('workspace_id', scheduledPost.workspace_id)
        .eq('platform', 'linkedin')
        .eq('is_active', true)
        .single();

      if (accountError || !linkedinAccount) {
        console.log('❌ No active LinkedIn account found for workspace');
        await this.markPostAsFailed(scheduledPost.id, 'No active LinkedIn account connected');
        return;
      }

      // LinkedIn API call
      const result = await this.makeLinkedInPost(
        post.content,
        linkedinAccount.access_token,
        linkedinAccount.account_id
      );

      if (result.success) {
        await this.markPostAsPublished(scheduledPost.id, result.postId);
        console.log(`✅ LinkedIn post published successfully: ${scheduledPost.id}`);
      } else {
        await this.markPostAsFailed(scheduledPost.id, result.error);
        console.log(`❌ Failed to publish LinkedIn post: ${scheduledPost.id}`, result.error);
      }

    } catch (error: any) {
      console.error(`❌ Error publishing LinkedIn post ${scheduledPost.id}:`, error);
      await this.markPostAsFailed(scheduledPost.id, error.message);
    }
  }

  private async makeLinkedInPost(content: string, accessToken: string, personUrn: string) {
    try {
      // LinkedIn UGC Post API
      const postData = {
        author: `urn:li:person:${personUrn}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: "NONE"
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LinkedIn API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      return { success: true, postId: data.id };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async markPostAsPublished(postId: string, linkedinPostId: string) {
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: linkedinPostId
      })
      .eq('id', postId);
  }

  private async markPostAsFailed(postId: string, error: string) {
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: error
      })
      .eq('id', postId);
  }

  // Manual trigger for testing
  async manualPublish(req: Request, res: Response) {
    try {
      await this.processScheduledPosts();
      res.json({ 
        success: true, 
        message: 'Manual publishing triggered' 
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

// Create singleton instance
export const schedulerController = new SchedulerController();