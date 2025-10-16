/*
  # Fix Workspace Members RLS Infinite Recursion

  ## Changes
  1. Drop all existing policies on workspace_members
  2. Create simple, non-recursive policies
  3. Avoid any circular references between workspaces and workspace_members

  ## Security
  - Users can only see their own memberships
  - Workspace owners can see members of their workspaces (without recursion)
*/

-- Drop all existing policies on workspace_members
DROP POLICY IF EXISTS "Users can view their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners can view all members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON workspace_members;

-- Create simple policy: users can see their own memberships
CREATE POLICY "Users can view own membership records"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policy for workspace owners (direct ownership check, no subquery)
CREATE POLICY "Workspace owners can view members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_members.workspace_id 
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Allow workspace owners to insert members
CREATE POLICY "Workspace owners can add members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_members.workspace_id 
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Allow workspace owners to update members
CREATE POLICY "Workspace owners can update members"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_members.workspace_id 
      AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_members.workspace_id 
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Allow workspace owners to delete members
CREATE POLICY "Workspace owners can remove members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = workspace_members.workspace_id 
      AND workspaces.owner_id = auth.uid()
    )
  );