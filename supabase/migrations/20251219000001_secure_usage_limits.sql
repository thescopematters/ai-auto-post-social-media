-- Enable RLS on user_usage_limits
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own usage limits
CREATE POLICY "Users can view own usage limits"
  ON user_usage_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: No INSERT/UPDATE/DELETE policies are added for 'authenticated' role.
-- This ensures that only the server (using service_role) can modify usage data.
