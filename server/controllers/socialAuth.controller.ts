import { Request, Response } from "express";
import axios from "axios";
import supabaseAdmin from "../config/database";
import logger from "../config/logger";

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
    // Just check query param or hardcode for now
    let userId = req.query.userId as string;

    if (!userId) {
      logger.error("No userId provided");
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      return res.redirect(`${frontendUrl}/signin?error=user_id_required`);
    }

    logger.info("LinkedIn OAuth for user:", { userId });

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

    logger.info("Redirecting to LinkedIn");
    res.redirect(linkedInAuthUrl.toString());
  } catch (error: any) {
    logger.error("LinkedIn auth failed:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
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

    logger.info("LinkedIn callback for user:", { userId });

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      tokenParams,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, expires_in, refresh_token } = tokenResponse.data;

    // Get profile
    const profileResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
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

    // First, delete old account if exists
    await supabaseAdmin
      .from("social_accounts")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("platform", "linkedin");

    // Then insert new one
    const { error: dbError } = await supabaseAdmin
      .from("social_accounts")
      .insert({
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
      } as any);

    if (dbError) throw dbError;

    logger.info("LinkedIn account saved successfully");

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

    // Type-safe mapping
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

    const workspaceIds = ((workspaces as any) || []).map((w: any) => w.workspace_id);

    // @ts-ignore
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