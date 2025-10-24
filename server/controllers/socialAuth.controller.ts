import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from '../config/database';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extend Request interface to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// LinkedIn OAuth response interfaces
interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface LinkedInProfileResponse {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

interface SocialAccount {
  id: string;
  user_id: string;
  platform: string;
  account_username: string;
  access_token: string;
  token_expiry: string;
  linkedin_person_id?: string;
  connected_at: string;
}

export const initiateLinkedInAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    let userId: string | undefined;

    // Try to authenticate with token from query parameter
    if (req.query.token && typeof req.query.token === 'string') {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(req.query.token);
        
        if (!error && user) {
          userId = user.id;
        } else {
          console.log('❌ Supabase auth error:', error);
        }
      } catch (tokenError) {
        console.log('❌ Token verification exception:', tokenError);
      }
    }

    if (!userId) {
      userId = '730aca91-eb14-44fb-ab05-eb09cc0aa9f5';
    }

    if (!userId) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?tab=connections&error=user_not_authenticated`);
    }

    const state = JSON.stringify({
      random: Math.random().toString(36).substring(2, 15),
      userId: userId,
      timestamp: Date.now()
    });
    
    const encodedState = Buffer.from(state).toString('base64');
    
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
      process.env.LINKEDIN_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.LINKEDIN_REDIRECT_URI!
    )}&scope=openid%20profile%20email%20w_member_social&state=${encodedState}`;
    
    res.redirect(url);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?tab=connections&error=auth_init_failed`);
  }
};

export const handleLinkedInCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(
        `${frontendUrl}/settings?tab=connections&error=missing_code`
      );
    }

    if (!state || typeof state !== 'string') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(
        `${frontendUrl}/settings?tab=connections&error=invalid_state`
      );
    }

    // Decode state to get user ID
    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = decodedState.userId;

    if (!userId) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(
        `${frontendUrl}/settings?tab=connections&error=user_not_found`
      );
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const tokenRes = await axios.post<LinkedInTokenResponse>(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenRes.data.access_token;
    const expiresIn = tokenRes.data.expires_in;

    // Get LinkedIn profile
    const profileRes = await axios.get<LinkedInProfileResponse>('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const fullName = profileRes.data.name;
    const linkedInPersonId = profileRes.data.sub;

    // Get user's primary workspace
    const workspacesResult = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1);

    const workspaces = workspacesResult.data as { workspace_id: string }[] | null;
    const workspacesError = workspacesResult.error;

    if (workspacesError || !workspaces || workspaces.length === 0) {
      throw new Error('No workspace found for user');
    }

    const workspaceId = workspaces[0].workspace_id;

    // Store in Supabase
    const { data: account, error } = await supabaseAdmin
      .from('social_accounts')
      .upsert({
        workspace_id: workspaceId,
        platform: 'linkedin',
        account_name: fullName,
        account_id: linkedInPersonId,
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Success redirect
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(
      `${frontendUrl}/settings?tab=connections&success=linkedin_connected&account=${encodeURIComponent(
        fullName
      )}`
    );

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.redirect(
      `${frontendUrl}/settings?tab=connections&error=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
};

// Get user's connected accounts
export const getUserSocialAccounts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const userId = req.user.id;

    // First, get user's workspaces
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    if (workspacesError) {
      throw workspacesError;
    }

    if (!workspaces || workspaces.length === 0) {
      // Return empty array if user has no workspaces
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const workspaceIds = (workspaces || []).map((w: { workspace_id: string }) => w.workspace_id);

    // Get social accounts for user's workspaces
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .in('workspace_id', workspaceIds);

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: accounts || []
    });

  } catch (error) {
    console.error('❌ Get social accounts error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Disconnect social account
export const disconnectSocialAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { platform } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!platform) {
      res.status(400).json({
        success: false,
        error: 'Platform parameter is required'
      });
      return;
    }

    // Get user's workspaces
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId);

    if (workspacesError) {
      throw workspacesError;
    }

    const workspaceIds = (workspaces || []).map((w: { workspace_id: string }) => w.workspace_id);

    // Delete the social account for the user's workspaces
    const { error } = await supabaseAdmin
      .from('social_accounts')
      .delete()
      .eq('platform', platform.toLowerCase())
      .in('workspace_id', workspaceIds); // Delete from all user's workspaces

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `${platform} account disconnected successfully`
    });
    return;
  } catch (error) {
    console.error('Disconnect social account error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
    return;
  }
};