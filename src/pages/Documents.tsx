import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Eye
} from 'lucide-react';

type Document = {
  id: string;
  title: string;
  file_type: string;
  file_size: number;
  processing_status: string;
  uploaded_at: string;
  content_text: string | null;
};

export function Documents() {
  const { currentWorkspace, user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
    } else {
      setLoading(false);
    }
  }, [currentWorkspace]);

  const loadDocuments = async () => {
    if (!currentWorkspace) return;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace || !user) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${currentWorkspace.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('documents').insert({
        workspace_id: currentWorkspace.id,
        uploaded_by: user.id,
        title: file.name,
        file_type: fileExt as any,
        file_url: publicUrl,
        file_size: file.size,
        processing_status: 'pending',
      } as any);

      if (!dbError) {
        await loadDocuments();
        setShowUploadModal(false);
      }
    }

    setUploading(false);
  };

  const handleUrlUpload = async (url: string, title: string) => {
    if (!currentWorkspace || !user) return;

    setUploading(true);

    const { error } = await supabase.from('documents').insert({
      workspace_id: currentWorkspace.id,
      uploaded_by: user.id,
      title: title || url,
      file_type: 'url',
      file_url: url,
      processing_status: 'pending',
    } as any);

    if (!error) {
      await loadDocuments();
      setShowUploadModal(false);
    }

    setUploading(false);
  };

  const handleTextUpload = async (text: string, title: string) => {
    if (!currentWorkspace || !user) return;

    setUploading(true);

    const { error } = await supabase.from('documents').insert({
      workspace_id: currentWorkspace.id,
      uploaded_by: user.id,
      title: title || 'Manual Text Input',
      file_type: 'manual',
      content_text: text,
      processing_status: 'completed',
    } as any);

    if (!error) {
      await loadDocuments();
      setShowUploadModal(false);
    }

    setUploading(false);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Upload and manage your content sources</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload Document
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <Filter className="w-5 h-5 mr-2" />
              Filter
            </button>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
            <p className="text-gray-600 mb-6">Upload your first document to get started</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Document
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <DocumentRow key={doc.id} document={doc} onDelete={loadDocuments} />
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onFileUpload={handleFileUpload}
          onUrlUpload={handleUrlUpload}
          onTextUpload={handleTextUpload}
          uploading={uploading}
          uploadType={uploadType}
          setUploadType={setUploadType}
        />
      )}
    </div>
  );
}

function DocumentRow({ document, onDelete }: { document: Document; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusIcon = () => {
    switch (document.processing_status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this document?')) {
      await supabase.from('documents').delete().eq('id', document.id);
      onDelete();
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
      <div className="p-3 bg-blue-50 rounded-lg">
        <FileText className="w-6 h-6 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate">{document.title}</h3>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm text-gray-500 capitalize">{document.file_type}</span>
          <span className="text-sm text-gray-500">
            {(document.file_size / 1024).toFixed(1)} KB
          </span>
          <span className="text-sm text-gray-500">
            {new Date(document.uploaded_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onFileUpload, onUrlUpload, onTextUpload, uploading, uploadType, setUploadType }: any) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadType === 'url' && url) {
      await onUrlUpload(url, title);
    } else if (uploadType === 'text' && text) {
      await onTextUpload(text, title);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
          <p className="text-gray-600 mt-1">Choose how you want to add content</p>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setUploadType('file')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                uploadType === 'file'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Upload className="w-5 h-5 mx-auto mb-1" />
              <span className="block text-sm font-medium">File Upload</span>
            </button>
            <button
              onClick={() => setUploadType('url')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                uploadType === 'url'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="w-5 h-5 mx-auto mb-1" />
              <span className="block text-sm font-medium">URL</span>
            </button>
            <button
              onClick={() => setUploadType('text')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                uploadType === 'text'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FileText className="w-5 h-5 mx-auto mb-1" />
              <span className="block text-sm font-medium">Text</span>
            </button>
          </div>

          {uploadType === 'file' && (
            <div>
              <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <span className="block text-gray-700 font-medium mb-2">
                  Click to upload or drag and drop
                </span>
                <span className="block text-sm text-gray-500">PDF, DOCX, TXT (max. 10MB)</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={onFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {uploadType === 'url' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/article"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload URL'}
              </button>
            </form>
          )}

          {uploadType === 'text' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Paste or type your content here..."
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {uploading ? 'Saving...' : 'Save Content'}
              </button>
            </form>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
