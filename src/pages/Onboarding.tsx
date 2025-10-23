import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, ArrowRight, Building2, Sparkles } from 'lucide-react';

export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!user || !workspaceName) return;

    setCreating(true);

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        owner_id: user.id,
      } as any)
      .select()
      .single();

    if (!workspaceError && workspace) {
      await supabase.from('subscriptions').insert({
        workspace_id: (workspace as any).id,
        tier: 'free',
        status: 'active',
      } as any);

      await supabase.from('ai_agent_configs').insert({
        workspace_id: (workspace as any).id,
        name: 'Default Agent',
        is_default: true,
      } as any);

      await refreshProfile();
      navigate('/dashboard');
    }

    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 text-white mb-6">
            <Sparkles className="w-10 h-10" />
            <span className="text-3xl font-bold">ContentAI Pro</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome aboard!</h1>
          <p className="text-gray-300">Let's set up your workspace in just a few steps</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium text-gray-700">Create Workspace</span>
            </div>
            <div className="flex-1 h-1 mx-4 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <span className="text-sm font-medium text-gray-700">Complete</span>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-blue-100 rounded-full mb-4">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Workspace</h2>
                <p className="text-gray-600">
                  A workspace is where you'll manage all your content and team members
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., My Company, Personal Brand"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <p className="mt-2 text-sm text-gray-500">
                  You can always change this later in settings
                </p>
              </div>

              <button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName || creating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Continue'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-400 mt-6 text-sm">
          Need help? Contact our support team
        </p>
      </div>
    </div>
  );
}
