import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock } from 'lucide-react';

type ScheduledPost = {
  id: string;
  content: string;
  scheduled_time: string;
  status: 'scheduled' | 'published' | 'failed';
  published_at?: string;
  error_message?: string;
  external_post_id?: string;
};

export function Schedule() {
  const { currentWorkspace } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);

  useEffect(() => {
    if (!currentWorkspace) return;

    const loadScheduledPosts = async () => {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select(`
          id,
          scheduled_time,
          status,
          published_at,
          error_message,
          external_post_id,
          post:generated_posts(content)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('Error fetching scheduled posts:', error);
      } else if (data) {
        const formattedPosts = data.map((item: any) => ({
          id: item.id,
          content: item.post.content,
          scheduled_time: item.scheduled_time,
          status: item.status,
          published_at: item.published_at,
          error_message: item.error_message,
          external_post_id: item.external_post_id,
        }));
        setPosts(formattedPosts);
      }
    };

    loadScheduledPosts();

    // Set up real-time subscription
    const subscription = supabase
      .channel('scheduled_posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_posts',
          filter: `workspace_id=eq.${currentWorkspace.id}`
        },
        () => {
          loadScheduledPosts(); // Refresh when posts change
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentWorkspace]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Publishing Schedule</h1>
        <p className="text-gray-600">Manage your LinkedIn content calendar</p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No scheduled posts yet</h3>
          <p className="text-gray-600">Schedule LinkedIn posts from the generator to see them here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-gray-800 whitespace-pre-wrap mb-3">{post.content}</p>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(post.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    {post.status === 'published' 
                      ? `Published: ${new Date(post.published_at!).toLocaleString()}`
                      : `Scheduled: ${new Date(post.scheduled_time).toLocaleString()}`
                    }
                  </p>
                </div>

                {post.external_post_id && (
                  <a 
                    href={`https://www.linkedin.com/feed/update/${post.external_post_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View on LinkedIn →
                  </a>
                )}
              </div>

              {post.error_message && (
                <p className="text-sm text-red-600 mt-2">Error: {post.error_message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}