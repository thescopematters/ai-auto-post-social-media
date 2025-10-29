import { Request, Response } from 'express';
import supabaseAdmin from '../config/database';
import logger from '../config/logger';

export class WorkspaceSocialAccountsController {
  // Get all social accounts for a specific workspace
  async getWorkspaceSocialAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      const { data: socialAccounts, error } = await supabaseAdmin
        .from('social_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('connected_at', { ascending: false });

      if (error) {
        logger.error('Database error fetching social accounts:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch social accounts'
        });
        return;
      }

      res.json({
        success: true,
        data: socialAccounts || []
      });
    } catch (error: any) {
      logger.error('Error in getWorkspaceSocialAccounts:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Connect a social account to a workspace
  async connectWorkspaceAccount(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { platform, accessToken, accountId, accountName } = req.body;

      // Check if account already exists for this workspace and platform
      const { data: existingAccount, error: checkError } = await supabaseAdmin
        .from('social_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('platform', platform)
        .eq('account_id', accountId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error checking existing account:', checkError);
        res.status(500).json({
          success: false,
          error: 'Failed to check existing account'
        });
        return;
      }

      let result;
      if (existingAccount) {
        // Update existing account
        result = await supabaseAdmin
          .from('social_accounts')
          .update({
            access_token: accessToken,
            account_name: accountName,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id)
          .select()
          .single();
      } else {
        // Create new account
        result = await supabaseAdmin
          .from('social_accounts')
          .insert({
            workspace_id: workspaceId,
            platform,
            access_token: accessToken,
            account_id: accountId,
            account_name: accountName,
            is_active: true,
            connected_at: new Date().toISOString(),
            last_sync: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        logger.error('Error saving social account:', result.error);
        res.status(500).json({
          success: false,
          error: 'Failed to connect social account'
        });
        return;
      }

      res.json({
        success: true,
        data: result.data,
        message: 'Social account connected successfully'
      });

    } catch (error: any) {
      logger.error('Error in connectWorkspaceAccount:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Disconnect a social account from workspace
  async disconnectWorkspaceAccount(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, accountId } = req.params;

      const { error } = await supabaseAdmin
        .from('social_accounts')
        .update({
          is_active: false,
          access_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .eq('workspace_id', workspaceId);

      if (error) {
        logger.error('Error disconnecting social account:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to disconnect social account'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Social account disconnected successfully'
      });

    } catch (error: any) {
      logger.error('Error in disconnectWorkspaceAccount:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update workspace social account
  async updateWorkspaceAccount(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, accountId } = req.params;
      const updateData = req.body;

      const { data: account, error } = await supabaseAdmin
        .from('social_accounts')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating social account:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update social account'
        });
        return;
      }
      
      res.json({
        success: true,
        data: account,
        message: 'Social account updated successfully'
      });

    } catch (error: any) {
      logger.error('Error in updateWorkspaceAccount:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

// Export singleton instance
export const workspaceSocialAccountsController = new WorkspaceSocialAccountsController();