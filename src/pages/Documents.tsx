import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { documentApi, workspaceApi } from "../lib/apiClient";
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Eye,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
  const { currentWorkspace } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [workspaceLimits, setWorkspaceLimits] = useState<any>(null);

  useEffect(() => {
    if (currentWorkspace) {
      loadDocuments();
      loadWorkspaceLimits();
    } else {
      setLoading(false);
    }
  }, [currentWorkspace]);

  const loadDocuments = async () => {
    if (!currentWorkspace) return;

    try {
      const response = await documentApi.getAll(currentWorkspace.id, 1, 100);

      if (response.success && response.data) {
        setDocuments(response.data as Document[]);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceLimits = async () => {
    if (!currentWorkspace) return;
    try {
      const response = await workspaceApi.getLimits(currentWorkspace.id);
      if (response.success && response.data) {
        setWorkspaceLimits(response.data);
      }
    } catch (error) {
      console.error("Error loading workspace limits:", error);
    }
  };

  const handleTextUpload = async (text: string, title: string) => {
    if (!currentWorkspace) return;

    if (
      workspaceLimits?.documentUpload &&
      !workspaceLimits.documentUpload.canUpload
    ) {
      setShowUploadModal(false);
      setShowUpgradeModal(true);

      toast.error("Document Limit Reached", {
        description: `You've used all ${workspaceLimits.documentUpload.limit} document slots.`,
        duration: 5000,
      });
      return;
    }

    setUploading(true);

    try {
      const response = await documentApi.create(currentWorkspace.id, {
        title: title || "Manual Text Input",
        fileType: "manual",
        contentText: text,
      });

      if (response.success) {
        await loadDocuments();
        await loadWorkspaceLimits();
        setShowUploadModal(false);
        toast.success("Document uploaded successfully!");
      } else {
        throw new Error(response.error);
      }
    } catch (error: any) {
      console.error("Error uploading text:", error);

      const errorMsg = error?.response?.data?.error || error?.message || "";

      if (
        errorMsg.includes("limit reached") ||
        errorMsg.includes("Document limit")
      ) {
        setShowUploadModal(false);
        setShowUpgradeModal(true);

        toast.error("Document Limit Reached", {
          description: errorMsg,
          duration: 5000,
        });
      } else {
        toast.error("Upload failed", {
          description: errorMsg || "Failed to upload document",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) =>
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
          <p className="text-gray-600">
            Upload and manage your content sources
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload Document
        </button>
      </div>

      {workspaceLimits?.documentUpload &&
        workspaceLimits.documentUpload.remaining <= 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    workspaceLimits.documentUpload.canUpload
                      ? "bg-yellow-50"
                      : "bg-red-50"
                  }`}
                >
                  {workspaceLimits.documentUpload.canUpload ? (
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${
                      workspaceLimits.documentUpload.canUpload
                        ? "text-yellow-900"
                        : "text-red-900"
                    }`}
                  >
                    {workspaceLimits.documentUpload.canUpload
                      ? "Document Limit Warning"
                      : "Document Limit Reached"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p
                      className={`text-sm ${
                        workspaceLimits.documentUpload.canUpload
                          ? "text-yellow-700"
                          : "text-red-700"
                      }`}
                    >
                      {workspaceLimits.documentUpload.canUpload
                        ? `Only ${
                            workspaceLimits.documentUpload.remaining
                          } document${
                            workspaceLimits.documentUpload.remaining === 1
                              ? ""
                              : "s"
                          } left`
                        : `You've used all ${workspaceLimits.documentUpload.limit} document slots`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div
                  className={`p-2 rounded-lg ${
                    workspaceLimits.documentUpload.canUpload
                      ? "bg-yellow-50"
                      : "bg-red-50"
                  }`}
                ></div>
              </div>
            </div>

            {/* Upgrade Message */}
            <div
              className={`mt-4 p-3 rounded-lg border ${
                workspaceLimits.documentUpload.canUpload
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`w-4 h-4 ${
                    workspaceLimits.documentUpload.canUpload
                      ? "text-yellow-600"
                      : "text-red-600"
                  } flex-shrink-0`}
                />
                <p
                  className={`text-sm ${
                    workspaceLimits.documentUpload.canUpload
                      ? "text-yellow-800"
                      : "text-red-800"
                  }`}
                >
                  {workspaceLimits.documentUpload.canUpload
                    ? `Only ${
                        workspaceLimits.documentUpload.remaining
                      } document${
                        workspaceLimits.documentUpload.remaining === 1
                          ? ""
                          : "s"
                      } left. `
                    : "You've reached your document limit. "}
                  <button
                    onClick={() => (window.location.href = "/subscription")}
                    className={`font-semibold underline hover:${
                      workspaceLimits.documentUpload.canUpload
                        ? "text-yellow-900"
                        : "text-red-900"
                    } transition`}
                  >
                    Upgrade to Pro
                  </button>{" "}
                  for unlimited documents.
                </p>
              </div>
            </div>
          </div>
        )}

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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No documents yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your first document to get started
            </p>
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
              <DocumentRow
                key={doc.id}
                document={doc}
                onDelete={loadDocuments}
              />
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onTextUpload={handleTextUpload}
          uploading={uploading}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentLimit={workspaceLimits?.documentUpload?.limit || 2}
          currentCount={workspaceLimits?.documentUpload?.currentCount || 0}
        />
      )}
    </div>
  );
}

function DocumentRow({
  document,
  onDelete,
}: {
  document: Document;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = () => {
    switch (document.processing_status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processing":
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        onDelete();
      } catch (error) {
        console.error("Error deleting document:", error);
      }
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
          <span className="text-sm text-gray-500 capitalize">
            {document.file_type}
          </span>
          <span className="text-sm text-gray-500">
            {formatFileSize(document.file_size)}
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

function UploadModal({
  onClose,
  onTextUpload,
  uploading,
}: {
  onClose: () => void;
  onTextUpload: (text: string, title: string) => Promise<void>;
  uploading: boolean;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title && text) {
      await onTextUpload(text, title);
      setText("");
      setTitle("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
          <p className="text-gray-600 mt-1">
            Add content by pasting or typing text
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter a title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
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
              {uploading ? "Saving..." : "Save Content"}
            </button>
          </form>
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

function UpgradeModal({
  onClose,
  currentLimit,
  currentCount,
}: {
  onClose: () => void;
  currentLimit: number;
  currentCount: number;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Document Limit Reached
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Free plan: {currentLimit} documents
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            You've reached the maximum number of documents for the free plan.
            Upgrade to Pro to unlock more features!
          </p>

          {/* Pro Features */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">Pro Plan Benefits</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>
                  <strong>20 Documents</strong> - 10x more storage
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>
                  <strong>100 AI Generations</strong> - Create more content
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>
                  <strong>Unlimited Posts</strong> - Post as much as you want
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>
                  <strong>Priority Support</strong> - Get help faster
                </span>
              </li>
            </ul>
          </div>

          {/* Current Usage */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Current Plan</span>
              <span className="font-semibold text-gray-900">Free</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full"
                style={{ width: "100%" }}
              ></div>
            </div>
            <p className="text-gray-600 mt-2">
              {currentCount} / {currentLimit} documents used
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Maybe Later
          </button>
          <button
            onClick={() => {
              onClose();
              // Navigate to pricing page
              window.location.href = "/subscription";
            }}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-semibold"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
