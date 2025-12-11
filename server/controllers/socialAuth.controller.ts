import { Request, Response } from "express";
import axios from "axios";
import supabaseAdmin from "../config/database";
import logger from "../config/logger";
// 🌟 NEW: Import the built-in 'https' module for agent configuration
import https from "https"; 
import dotenv from "dotenv";
dotenv.config();
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const initiateLinkedInAuth = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    let userId = req.query.userId as string;

    if (!userId) {
      logger.error("No userId provided");
      const frontendUrl = process.env.FRONTEND_URL || "https://zeroeffortposts.com/";
      return res.redirect(`${frontendUrl}/signin?error=user_id_required`);
    }

    const state = JSON.stringify({
      userId: userId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
    });

    const encodedState = Buffer.from(state).toString("base64url");

    const linkedInAuthUrl = new URL(
      "https://www.linkedin.com/oauth/v2/authorization"
    );
    linkedInAuthUrl.searchParams.append("response_type", "code");
    linkedInAuthUrl.searchParams.append(
      "client_id",
      process.env.LINKEDIN_CLIENT_ID!
    );
    linkedInAuthUrl.searchParams.append(
      "redirect_uri",
      process.env.LINKEDIN_REDIRECT_URI!
    );
    linkedInAuthUrl.searchParams.append(
      "scope",
      "openid profile email w_member_social"
    );
    linkedInAuthUrl.searchParams.append("state", encodedState);
    res.redirect(linkedInAuthUrl.toString());
  } catch (error: any) {
    logger.error("LinkedIn auth failed:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://locahost:3000";
    res.redirect(`${frontendUrl}/settings?error=auth_failed`);
  }
};

export const handleLinkedInCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { code, state, error: linkedinError } = req.query;

    if (linkedinError) {
      throw new Error(`LinkedIn error: ${linkedinError}`);
    }

    if (!code || typeof code !== "string") {
      throw new Error("No authorization code");
    }

    if (!state || typeof state !== "string") {
      throw new Error("No state parameter");
    }

    let decodedState;
    try {
      decodedState = JSON.parse(Buffer.from(state, "base64url").toString());
    } catch (e) {
      throw new Error("Invalid state");
    }

    const userId = decodedState.userId;
    if (!userId) throw new Error("No userId in state");

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    // 🌟 Timeout added previously for robustness
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      tokenParams,
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // "ngrok-skip-browser-warning": "true",
        }
      }
    );

    const { access_token, expires_in, refresh_token } = tokenResponse.data;

    // Get profile
    // 🌟 UPDATED: Added httpsAgent with family: 4 to force IPv4
    const profileResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${access_token}`,
          // "ngrok-skip-browser-warning": "true",
        },
        httpsAgent: new https.Agent({ family: 4 }),
      }
    );

    const { sub: linkedinUserId, name: fullName } = profileResponse.data;

    // Get workspace
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1);

    if (workspacesError || !workspaces || workspaces.length === 0) {
      throw new Error("No workspace found");
    }

    const workspaceId = (workspaces as Array<{ workspace_id: string }>)[0]
      .workspace_id;
    const tokenExpiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    const { error: dbError } = await supabaseAdmin
      .from("social_accounts")
      .upsert([
        {
          workspace_id: workspaceId,
          platform: "linkedin",
          account_name: fullName,
          account_id: linkedinUserId,
          access_token: access_token,
          refresh_token: refresh_token || null,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          connected_at: new Date().toISOString(),
          last_sync: new Date().toISOString(),
        }] as any,
        {
          onConflict: "workspace_id,platform",
        }
      );

    if (dbError) throw dbError;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const successUrl = `${frontendUrl}/settings?tab=connections&success=linkedin_connected&account=${encodeURIComponent(
      fullName
    )}`;

    res.redirect(successUrl);
  } catch (error: any) {
    logger.error("LinkedIn callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(
      `${frontendUrl}/settings?tab=connections&error=${encodeURIComponent(
        error.message
      )}`
    );
  }
};

export const refreshLinkedInToken = async (
  workspaceId: string,
  refreshToken: string
) => {
  try {
    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      tokenParams,
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // "ngrok-skip-browser-warning": "true",
        },
      }
    );

    const { access_token, expires_in, refresh_token } = response.data;
    const tokenExpiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    // DB update करो
    await supabaseAdmin
      .from("social_accounts")
      .update({
        access_token: access_token,
        refresh_token: refresh_token || null,
        token_expires_at: tokenExpiresAt,
        last_sync: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("platform", "linkedin");

    return true;
  } catch (error) {
    logger.error("Token refresh failed:", error);
    return false;
  }
};

export const validateAndRefreshToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) => {
  try {
    if (!req.user) return next();

    const userId = req.user.id;

    const { data: workspaces } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId);

    if (!workspaces?.length) return next();

    const workspaceIds = workspaces.map((w: any) => w.workspace_id);

    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select("*")
      .in("workspace_id", workspaceIds)
      .eq("is_active", true);

    // Check if token expired
    for (const account of accounts || []) {
      const expiresAt = new Date(account.token_expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      // Refresh if expires in 5 minutes
      if (timeUntilExpiry < fiveMinutes && account.refresh_token) {
        await refreshLinkedInToken(account.workspace_id, account.refresh_token);
      }
    }

    next();
  } catch (error) {
    logger.warn("Token validation error:", error);
    next();
  }
};

export const getUserSocialAccounts = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const userId = req.user.id;

    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId);

    if (workspacesError || !workspaces || workspaces.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const workspaceIds = (workspaces as Array<{ workspace_id: string }>).map(
      (w) => w.workspace_id
    );

    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select("*")
      .in("workspace_id", workspaceIds)
      .eq("is_active", true);

    res.json({ success: true, data: accounts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};

export const disconnectSocialAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { platform } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { data: workspaces } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId);

    const workspaceIds = ((workspaces as any) || []).map(
      (w: any) => w.workspace_id
    );

    await supabaseAdmin
      .from("social_accounts")
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
      }) 
      .eq("platform", (platform || "").toLowerCase())
      .in("workspace_id", workspaceIds);

    res.json({
      success: true,
      message: `${platform} disconnected`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};