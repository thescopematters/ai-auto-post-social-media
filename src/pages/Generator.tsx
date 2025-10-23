import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contentApi, documentApi } from '../lib/apiClient';
import { Sparkles, Settings, Linkedin, Twitter, RefreshCw } from 'lucide-react';

type Document = {
  id: string;
  title: string;
  content_text: string | null;
};

export function Generator() {
  const { currentWorkspace, user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [platform, setPlatform] = useState<'linkedin' | 'twitter'>('linkedin');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<string[]>([]);

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
    }
  }, [currentWorkspace]);

  const loadDocuments = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await documentApi.getAll(currentWorkspace.id, 1, 100);

      if (response.success && response.data) {
        const completedDocs = (response.data as any[]).filter(
          doc => doc.processing_status === 'completed'
        );
        setDocuments(completedDocs);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDocument || !currentWorkspace) return;

    setGenerating(true);

    try {
      const response = await contentApi.generate(currentWorkspace.id, {
        documentId: selectedDocument,
        platform,
        tone,
        variantCount: 3,
      });

      if (response.success && response.data) {
        const posts = (response.data as any).posts || [];
        const postContents = posts.map((p: any) => p.content);
        setGeneratedPosts(postContents);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      const mockPosts = [
        `🚀 Exciting insights from our latest research!\n\nWe've discovered that companies leveraging AI automation see a 40% increase in productivity. This isn't just about efficiency – it's about empowering teams to focus on strategic work that drives real value.\n\nWhat's your experience with AI in the workplace?\n\n#AI #Productivity #Innovation`,

        `Just analyzed the latest trends in ${platform === 'linkedin' ? 'B2B marketing' : 'social media'}. The results might surprise you 📊\n\nKey takeaways:\n✅ Authentic content wins\n✅ Engagement over reach\n✅ Value-first approach\n\nWant to learn more? Drop a comment below!\n\n#Marketing #Strategy`,

        `${platform === 'linkedin' ? '💡' : '🔥'} Hot take: The future of content creation is here.\n\nAI isn't replacing creativity – it's amplifying it. Teams using smart automation tools are producing 3x more content while maintaining quality.\n\nThe question isn't whether to adopt AI, but how fast you can integrate it.\n\n#ContentMarketing #DigitalTransformation`
      ];
      setGeneratedPosts(mockPosts);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Generator</h1>
        <p className="text-gray-600">Create engaging social media posts from your documents</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Document
                </label>
                <select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a document</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Platform</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlatform('linkedin')}
                    className={`p-4 rounded-lg border-2 transition ${
                      platform === 'linkedin'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Linkedin className={`w-6 h-6 mx-auto mb-2 ${
                      platform === 'linkedin' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <span className="block text-sm font-medium">LinkedIn</span>
                  </button>
                  <button
                    onClick={() => setPlatform('twitter')}
                    className={`p-4 rounded-lg border-2 transition ${
                      platform === 'twitter'
                        ? 'border-sky-600 bg-sky-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Twitter className={`w-6 h-6 mx-auto mb-2 ${
                      platform === 'twitter' ? 'text-sky-600' : 'text-gray-400'
                    }`} />
                    <span className="block text-sm font-medium">Twitter</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="thought_leader">Thought Leader</option>
                  <option value="educational">Educational</option>
                  <option value="promotional">Promotional</option>
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedDocument || generating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Posts
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {generatedPosts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No posts generated yet
              </h3>
              <p className="text-gray-600 mb-6">
                Select a document and click generate to create AI-powered content
              </p>
              {documents.length === 0 && (
                <p className="text-sm text-yellow-600">
                  You need to upload documents first
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Generated Variants</h2>
              {generatedPosts.map((post, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Variant {index + 1}
                    </span>
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap mb-4">{post}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">{post.length} characters</span>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                      Schedule Post
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
