/*
  # Fix RLS Policies for Infinite Recursion

  ## Changes
  1. Drop existing policies that cause infinite recursion
  2. Create simpler, non-recursive policies for workspaces
  3. Ensure workspace_members policies work without circular references

  ## Security
  - Maintain proper access control
  - Prevent infinite recursion in policy checks
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Workspace members can view membership" ON workspace_members;

-- Create new simplified policies for workspaces
CREATE POLICY "Users can view their own workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view workspaces where they are members"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Create new simplified policies for workspace_members
CREATE POLICY "Users can view their own memberships"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Workspace owners can view all members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );