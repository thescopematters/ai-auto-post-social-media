-- Allow service role to bypass RLS on subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix existing policy to include WITH CHECK
DROP POLICY IF EXISTS "Workspace owners can manage subscriptions" ON subscriptions;
CREATE POLICY "Workspace owners can manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
