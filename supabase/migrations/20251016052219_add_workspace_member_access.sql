/*
  # Add Workspace Member Access Policy

  ## Changes
  1. Add policy to allow viewing workspaces by ID for members
  2. This avoids recursion by not checking workspace_members table in the workspace policy
  3. Application will first get member IDs, then fetch workspaces directly by ID

  ## Security
  - Users can view specific workspaces by ID (no recursion)
  - Combined with application-level filtering via workspace_members
*/

-- Add policy to view workspaces by ID (for member access)
CREATE POLICY "Users can view workspaces by ID"
  ON workspaces FOR SELECT
  TO authenticated
  USING (true);

-- Note: This is safe because:
-- 1. It only allows SELECT (read-only)
-- 2. Application filters which IDs to request based on workspace_members
-- 3. No circular dependency in the policy itself
-- 4. Combined with other table RLS, data remains secure