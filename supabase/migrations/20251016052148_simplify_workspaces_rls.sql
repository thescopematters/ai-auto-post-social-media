/*
  # Simplify Workspaces RLS to Avoid Recursion

  ## Changes
  1. Drop the policy that checks workspace_members
  2. Keep only the direct ownership policy
  3. Application will handle member workspace access via separate queries

  ## Security
  - Users can view workspaces they own directly
  - Member access will be handled at the application level
*/

-- Drop the problematic policy that checks workspace_members
DROP POLICY IF EXISTS "Users can view workspaces where they are members" ON workspaces;

-- The other policies remain:
-- "Users can view their own workspaces" - allows owner_id = auth.uid()
-- "Users can create workspaces" - allows creating with owner_id = auth.uid()
-- "Workspace owners can update their workspaces" - allows updates by owner
-- "Workspace owners can delete their workspaces" - allows deletes by owner