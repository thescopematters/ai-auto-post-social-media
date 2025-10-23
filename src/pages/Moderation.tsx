import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contentApi } from '../lib/apiClient';
import { CheckCircle, XCircle, AlertTriangle, Linkedin, Twitter } from 'lucide-react';

type Post = {
  id: string;
  content: string;
  platform: string;
  moderation_status: string;
  generated_at: string;
  documents: { title: string } | null;
};

export function Moderation() {
  const { currentWorkspace, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) {
      loadPosts();
    } else {
      setLoading(false);
    }
  }, [currentWorkspace, filter]);

  const loadPosts = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await contentApi.getAllPosts(currentWorkspace.id, 1, 100, filter);

      if (response.success && response.data) {
        setPosts(response.data as Post[]);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeration = async (postId: string, action: 'approved' | 'rejected') => {
    if (!currentWorkspace) return;

    try {
      await contentApi.moderatePost(currentWorkspace.id, postId, action);
      await loadPosts();
    } catch (error) {
      console.error('Error moderating post:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Moderation</h1>
        <p className="text-gray-600">Review and approve generated content</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts to review</h3>
            <p className="text-gray-600">All posts in this category have been processed</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {posts.map((post) => (
              <div key={post.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      post.platform === 'linkedin' ? 'bg-blue-100' : 'bg-sky-100'
                    }`}>
                      {post.platform === 'linkedin' ? (
                        <Linkedin className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Twitter className="w-5 h-5 text-sky-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{post.platform}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(post.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {post.documents && (
                    <span className="text-sm text-gray-500">
                      From: {post.documents.title}
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                </div>

                {filter === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleModeration(post.id, 'rejected')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleModeration(post.id, 'approved')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
