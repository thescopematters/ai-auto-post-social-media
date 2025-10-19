import axios from 'axios';
import logger from '../config/logger';

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface PostResult {
  id: string;
  status: 'success' | 'failed';
  platformPostId?: string;
  error?: string;
}

class LinkedInService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private redirectUri: string | undefined;
  private isSandbox: boolean = process.env.LINKEDIN_SANDBOX_MODE === 'true';

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/auth/linkedin/callback';

    if (this.isSandbox || !this.clientId || !this.clientSecret) {
      logger.info('LinkedIn Service running in SANDBOX mode');
      this.isSandbox = true;
    } else {
      logger.info('LinkedIn Service initialized');
    }
  }

  getAuthorizationUrl(state: string): string {
    if (this.isSandbox) {
      return `https://sandbox-linkedin.contentai.local/oauth/authorize?state=${state}`;
    }

    const scope = 'r_liteprofile r_emailaddress w_member_social';
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri!)}&state=${state}&scope=${encodeURIComponent(scope)}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (this.isSandbox) {
      return {
        accessToken: `sandbox_linkedin_token_${Date.now()}`,
        expiresIn: 5184000,
      };
    }

    try {
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('LinkedIn token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for LinkedIn token');
    }
  }

  async getProfile(accessToken: string): Promise<LinkedInProfile> {
    if (this.isSandbox) {
      return {
        id: `linkedin_${Date.now()}`,
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: 'https://via.placeholder.com/150',
      };
    }

    try {
      const response = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: response.data.id,
        firstName: response.data.localizedFirstName,
        lastName: response.data.localizedLastName,
      };
    } catch (error: any) {
      logger.error('LinkedIn profile fetch error:', error.response?.data || error.message);
      throw new Error('Failed to fetch LinkedIn profile');
    }
  }

  async publishPost(accessToken: string, content: string, imageUrls?: string[]): Promise<PostResult> {
    if (this.isSandbox) {
      logger.info('SANDBOX: Would publish LinkedIn post:', content.substring(0, 100));
      return {
        id: `linkedin_post_${Date.now()}`,
        status: 'success',
        platformPostId: `urn:li:share:${Date.now()}`,
      };
    }

    try {
      const profileResponse = await this.getProfile(accessToken);
      const authorUrn = `urn:li:person:${profileResponse.id}`;

      const postData: any = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: imageUrls && imageUrls.length > 0 ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      if (imageUrls && imageUrls.length > 0) {
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = imageUrls.map(url => ({
          status: 'READY',
          originalUrl: url,
        }));
      }

      const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      logger.info('LinkedIn post published successfully:', response.data.id);

      return {
        id: response.data.id,
        status: 'success',
        platformPostId: response.data.id,
      };
    } catch (error: any) {
      logger.error('LinkedIn post publication error:', error.response?.data || error.message);
      return {
        id: `failed_${Date.now()}`,
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (this.isSandbox) {
      return {
        accessToken: `sandbox_linkedin_refreshed_${Date.now()}`,
        expiresIn: 5184000,
      };
    }

    try {
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('LinkedIn token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh LinkedIn token');
    }
  }
}

export default new LinkedInService();
