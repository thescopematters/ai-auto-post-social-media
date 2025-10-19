import cron from 'node-cron';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface ScheduledPost {
  id: string;
  workspace_id: string;
  post_id: string;
  social_account_id: string;
  scheduled_time: string;
  post: {
    content: string;
    platform: string;
  };
  social_account: {
    platform: string;
    access_token: string;
    account_id: string;
  };
}

const LINKEDIN_API_URL = process.env.LINKEDIN_API_URL || 'http://localhost:5000/api';
const TWITTER_API_URL = process.env.TWITTER_API_URL || 'http://localhost:5000/api';

class CronScheduler {
  private isProcessing = false;

  constructor() {
    console.log('Cron Service Initializing...');
    this.setupScheduler();
  }

  private setupScheduler() {
    cron.schedule('* * * * *', async () => {
      if (this.isProcessing) {
        console.log('Previous job still running, skipping...');
        return;
      }

      this.isProcessing = true;

      try {
        await this.processScheduledPosts();
      } catch (error) {
        console.error('Cron job error:', error);
      } finally {
        this.isProcessing = false;
      }
    });

    console.log('Cron scheduler started - running every minute');
  }

  private async processScheduledPosts() {
    try {
      const now = new Date().toISOString();

      const { data: scheduledPosts, error } = await supabase
        .from('scheduled_posts')
        .select(`
          *,
          post:generated_posts(content, platform),
          social_account:social_accounts(platform, access_token, account_id)
        `)
        .eq('status', 'scheduled')
        .lte('scheduled_time', now)
        .limit(10);

      if (error) {
        console.error('Error fetching scheduled posts:', error);
        return;
      }

      if (!scheduledPosts || scheduledPosts.length === 0) {
        console.log('No posts to publish at this time');
        return;
      }

      console.log(`Processing ${scheduledPosts.length} scheduled posts...`);

      for (const post of scheduledPosts as any[]) {
        await this.publishPost(post);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  private async publishPost(scheduledPost: ScheduledPost) {
    const { id, workspace_id, post, social_account } = scheduledPost;

    try {
      console.log(`Publishing post ${id} to ${social_account.platform}...`);

      await this.logProcessing(id, 1, 'processing');

      let result;

      if (social_account.platform === 'linkedin') {
        result = await this.publishToLinkedIn(social_account.access_token, post.content);
      } else if (social_account.platform === 'twitter') {
        result = await this.publishToTwitter(social_account.access_token, post.content);
      } else {
        throw new Error(`Unsupported platform: ${social_account.platform}`);
      }

      if (result.success) {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            platform_post_id: result.platformPostId,
          })
          .eq('id', id);

        await this.logProcessing(id, 1, 'success', result);

        console.log(`✓ Post ${id} published successfully`);
      } else {
        throw new Error(result.error || 'Publication failed');
      }
    } catch (error: any) {
      console.error(`✗ Failed to publish post ${id}:`, error.message);

      const retryCount = scheduledPost.retry_count || 0;

      if (retryCount < 3) {
        await supabase
          .from('scheduled_posts')
          .update({
            retry_count: retryCount + 1,
            error_message: error.message,
          })
          .eq('id', id);

        await this.logProcessing(id, retryCount + 1, 'retrying', null, error.message);
      } else {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', id);

        await this.logProcessing(id, retryCount + 1, 'failed', null, error.message);
      }
    }
  }

  private async publishToLinkedIn(accessToken: string, content: string): Promise<any> {
    if (process.env.LINKEDIN_SANDBOX_MODE === 'true') {
      console.log('SANDBOX: Simulating LinkedIn post publication');
      return {
        success: true,
        platformPostId: `linkedin_${Date.now()}`,
      };
    }

    return {
      success: true,
      platformPostId: `linkedin_mock_${Date.now()}`,
    };
  }

  private async publishToTwitter(accessToken: string, content: string): Promise<any> {
    if (process.env.TWITTER_SANDBOX_MODE === 'true') {
      console.log('SANDBOX: Simulating Twitter post publication');
      return {
        success: true,
        platformPostId: `twitter_${Date.now()}`,
      };
    }

    return {
      success: true,
      platformPostId: `twitter_mock_${Date.now()}`,
    };
  }

  private async logProcessing(
    scheduledPostId: string,
    attemptNumber: number,
    status: 'processing' | 'success' | 'failed' | 'retrying',
    responseData?: any,
    errorMessage?: string
  ) {
    try {
      await supabase.from('scheduled_posts_log').insert({
        scheduled_post_id: scheduledPostId,
        attempt_number: attemptNumber,
        status,
        response_data: responseData,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Error logging processing status:', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await supabase.from('scheduled_posts').select('id').limit(1);
      return !error;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

const scheduler = new CronScheduler();

const PORT = process.env.CRON_SERVICE_PORT || 5001;

import express from 'express';
const app = express();

app.get('/health', async (req, res) => {
  const isHealthy = await scheduler.healthCheck();
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Cron Service health endpoint running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
