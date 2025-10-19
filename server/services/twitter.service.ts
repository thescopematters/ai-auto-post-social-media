import axios from 'axios';
import logger from '../config/logger';

interface TwitterProfile {
  id: string;
  username: string;
  name: string;
  profileImage?: string;
}

interface TweetResult {
  id: string;
  status: 'success' | 'failed';
  platformPostId?: string;
  error?: string;
}

class TwitterService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private bearerToken: string | undefined;
  private redirectUri: string | undefined;
  private isSandbox: boolean = process.env.TWITTER_SANDBOX_MODE === 'true';

  constructor() {
    this.clientId = process.env.TWITTER_CLIENT_ID;
    this.clientSecret = process.env.TWITTER_CLIENT_SECRET;
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    this.redirectUri = process.env.TWITTER_REDIRECT_URI || 'http://localhost:5000/api/auth/twitter/callback';

    if (this.isSandbox || !this.clientId || !this.clientSecret) {
      logger.info('Twitter Service running in SANDBOX mode');
      this.isSandbox = true;
    } else {
      logger.info('Twitter Service initialized');
    }
  }

  getAuthorizationUrl(state: string): string {
    if (this.isSandbox) {
      return `https://sandbox-twitter.contentai.local/oauth/authorize?state=${state}`;
    }

    const scope = 'tweet.read tweet.write users.read offline.access';
    const codeChallenge = this.generateCodeChallenge();

    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri!)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (this.isSandbox) {
      return {
        accessToken: `sandbox_twitter_token_${Date.now()}`,
        refreshToken: `sandbox_twitter_refresh_${Date.now()}`,
        expiresIn: 7200,
      };
    }

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.clientId!,
          redirect_uri: this.redirectUri!,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('Twitter token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for Twitter token');
    }
  }

  async getProfile(accessToken: string): Promise<TwitterProfile> {
    if (this.isSandbox) {
      return {
        id: `twitter_${Date.now()}`,
        username: 'johndoe',
        name: 'John Doe',
        profileImage: 'https://via.placeholder.com/150',
      };
    }

    try {
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          'user.fields': 'profile_image_url',
        },
      });

      return {
        id: response.data.data.id,
        username: response.data.data.username,
        name: response.data.data.name,
        profileImage: response.data.data.profile_image_url,
      };
    } catch (error: any) {
      logger.error('Twitter profile fetch error:', error.response?.data || error.message);
      throw new Error('Failed to fetch Twitter profile');
    }
  }

  async publishTweet(accessToken: string, content: string, mediaIds?: string[]): Promise<TweetResult> {
    if (this.isSandbox) {
      logger.info('SANDBOX: Would publish tweet:', content.substring(0, 100));
      return {
        id: `twitter_tweet_${Date.now()}`,
        status: 'success',
        platformPostId: `${Date.now()}`,
      };
    }

    try {
      if (content.length > 280) {
        return this.publishThread(accessToken, content);
      }

      const tweetData: any = {
        text: content,
      };

      if (mediaIds && mediaIds.length > 0) {
        tweetData.media = {
          media_ids: mediaIds,
        };
      }

      const response = await axios.post(
        'https://api.twitter.com/2/tweets',
        tweetData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Tweet published successfully:', response.data.data.id);

      return {
        id: response.data.data.id,
        status: 'success',
        platformPostId: response.data.data.id,
      };
    } catch (error: any) {
      logger.error('Twitter post publication error:', error.response?.data || error.message);
      return {
        id: `failed_${Date.now()}`,
        status: 'failed',
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  private async publishThread(accessToken: string, content: string): Promise<TweetResult> {
    try {
      const chunks = this.splitIntoTweets(content);
      let previousTweetId: string | undefined;

      for (let i = 0; i < chunks.length; i++) {
        const tweetData: any = {
          text: `${chunks[i]} (${i + 1}/${chunks.length})`,
        };

        if (previousTweetId) {
          tweetData.reply = {
            in_reply_to_tweet_id: previousTweetId,
          };
        }

        const response = await axios.post(
          'https://api.twitter.com/2/tweets',
          tweetData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        previousTweetId = response.data.data.id;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`Twitter thread published successfully with ${chunks.length} tweets`);

      return {
        id: previousTweetId!,
        status: 'success',
        platformPostId: previousTweetId,
      };
    } catch (error: any) {
      logger.error('Twitter thread publication error:', error.response?.data || error.message);
      return {
        id: `failed_${Date.now()}`,
        status: 'failed',
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  private splitIntoTweets(content: string): string[] {
    const maxLength = 270;
    const chunks: string[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);

    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    return chunks;
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (this.isSandbox) {
      return {
        accessToken: `sandbox_twitter_refreshed_${Date.now()}`,
        refreshToken: `sandbox_twitter_refresh_new_${Date.now()}`,
        expiresIn: 7200,
      };
    }

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId!,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('Twitter token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Twitter token');
    }
  }

  private generateCodeChallenge(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  async getEngagementMetrics(tweetId: string, accessToken: string): Promise<any> {
    if (this.isSandbox) {
      return {
        likes: Math.floor(Math.random() * 100),
        retweets: Math.floor(Math.random() * 50),
        replies: Math.floor(Math.random() * 20),
        impressions: Math.floor(Math.random() * 1000),
      };
    }

    try {
      const response = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          'tweet.fields': 'public_metrics',
        },
      });

      return response.data.data.public_metrics;
    } catch (error: any) {
      logger.error('Twitter metrics fetch error:', error.response?.data || error.message);
      return null;
    }
  }
}

export default new TwitterService();
