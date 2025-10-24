// pages/LinkedInCallback.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function LinkedInCallback() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Processing LinkedIn connection...');

  useEffect(() => {
    const handleLinkedInCallback = async (): Promise<void> => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        console.log('LinkedIn Callback Received:', { 
          code: code ? '✓' : '✗', 
          state: state ? '✓' : '✗',
          error 
        });

        if (error) {
          setStatus(`Error: ${errorDescription || error}`);
          setTimeout(() => navigate('/settings?tab=connections&error=linkedin_failed'), 2000);
          return;
        }

        if (!code) {
          setStatus('No authorization code received from LinkedIn');
          setTimeout(() => navigate('/settings?tab=connections&error=no_code'), 2000);
          return;
        }

        // Verify state for security
        const storedState = localStorage.getItem('linkedin_oauth_state');
        if (state !== storedState) {
          setStatus('Security validation failed. Please try connecting again.');
          setTimeout(() => navigate('/settings?tab=connections&error=state_mismatch'), 2000);
          return;
        }

        setStatus('Exchanging authorization code...');

        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          setStatus('Please sign in to connect LinkedIn');
          setTimeout(() => navigate('/signin'), 2000);
          return;
        }

        // For demo purposes, we'll simulate successful connection
        // In production, you would send the code to your backend
        setStatus('Finalizing connection...');

        // Update profile to mark LinkedIn as connected
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            linkedin_connected: true,
            linkedin_data: { 
              connected_at: new Date().toISOString(),
              last_sync: new Date().toISOString(),
              // In real app, store the actual access token here
              access_token: 'demo_token_' + Math.random().toString(36).substr(2, 9)
            }
          } as any)
          .eq('id', user.id);

        if (updateError) {
          console.error('Supabase update error:', updateError);
          throw new Error('Failed to update profile');
        }

        await refreshProfile();
        
        setStatus('✅ LinkedIn connected successfully!');
        setTimeout(() => navigate('/settings?tab=connections&success=linkedin_connected'), 1500);

      } catch (error) {
        console.error('Error in LinkedIn callback:', error);
        setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => navigate('/settings?tab=connections&error=connection_failed'), 2000);
      } finally {
        // Clean up
        localStorage.removeItem('linkedin_oauth_state');
      }
    };

    handleLinkedInCallback();
  }, [navigate, refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Connecting to LinkedIn</h2>
        <p className="text-gray-600 text-sm">{status}</p>
        <p className="text-gray-400 text-xs mt-4">You will be redirected automatically...</p>
      </div>
    </div>
  );
}