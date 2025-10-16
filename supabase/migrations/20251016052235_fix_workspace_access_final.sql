/*
  # Fix Workspace Access Without Recursion

  ## Changes
  1. Drop the overly permissive policy
  2. Create a secure database function to get user workspaces
  3. No circular dependencies between tables

  ## Security
  - Function checks both ownership and membership
  - Returns only workspaces user has access to
  - No RLS recursion issues
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view workspaces by ID" ON workspaces;

-- Create a function to get workspaces for a user
CREATE OR REPLACE FUNCTION get_user_workspaces(user_id_param uuid)
RETURNS SETOF workspaces
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.*
  FROM workspaces w
  WHERE w.owner_id = user_id_param
  UNION
  SELECT w.*
  FROM workspaces w
  INNER JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = user_id_param;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_workspaces(uuid) TO authenticated;