import { useEffect, useState, useRef } from "react";
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
  X,
  Save,
  Edit,
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
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [viewDocument, setViewDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadDocuments();
      loadWorkspaceLimits();
    } else {
      setLoading(false);
    }
  }, [currentWorkspace]);

  const loadDocuments = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const response = await documentApi.getAll(currentWorkspace.id, 1, 100);
      if (response.success && response.data) {
        setDocuments(response.data as Document[]);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceLimits = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const response = await workspaceApi.getLimits(currentWorkspace.id);
      console.log(">>>>RES", response);
      if (response.success && response.data) {
        setWorkspaceLimits(response.data);
      }
    } catch (error) {
      console.error("Error loading workspace limits:", error);
    }
  };

  const handleUpload = async (data: { type: 'text' | 'file'; content?: string; title?: string; file?: File }) => {
    if (!currentWorkspace?.id) return;

    if (
      workspaceLimits?.documentUpload &&
      !workspaceLimits.documentUpload.canUpload
    ) {
      setShowUploadModal(false);
      setShowUpgradeModal(true);
      toast.error("Document Limit Reached", {
        description: workspaceLimits.documentUpload.limit === 0
          ? "You have unlimited documents in your plan."
          : `You've used all ${workspaceLimits.documentUpload.limit} document slots.`,
        duration: 5000,
      });
      return;
    }

    setUploading(true);

    try {
      let response;
      if (data.type === 'text' && data.content) {
        response = await documentApi.create(currentWorkspace.id, {
          title: data.title || "Manual Text Input",
          fileType: "manual",
          contentText: data.content,
        });
      } else if (data.type === 'file' && data.file) {
        const formData = new FormData();
        formData.append('file', data.file);
        if (data.title) {
          formData.append('title', data.title);
        }
        response = await documentApi.upload(currentWorkspace.id, formData);
      } else {
        throw new Error("Invalid upload data");
      }

      if (response.success) {
        await loadDocuments();
        await loadWorkspaceLimits();
        setShowUploadModal(false);
        toast.success("Document uploaded successfully!");
      } else {
        throw new Error(response.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("Error uploading document:", error);
      const errorMsg = error?.response?.data?.error || error?.message || "";
      if (
        errorMsg.includes("limit reached") ||
        errorMsg.includes("Document limit")
      ) {
        setShowUploadModal(false);
        setShowUpgradeModal(true);
        toast.error("Document Limit Reached", { description: errorMsg });
      } else {
        toast.error("Upload failed", { description: errorMsg });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    if (!currentWorkspace?.id) return;
    setDeleteConfirmation({ id, title });
  };

  const confirmDelete = async () => {
    if (!currentWorkspace?.id || !deleteConfirmation) return;

    try {
      const response = await documentApi.delete(
        currentWorkspace.id,
        deleteConfirmation.id
      );
      if (response.success) {
        toast.success("Document deleted successfully!");
        loadDocuments();
        loadWorkspaceLimits();
      } else {
        throw new Error(response.error || "Failed to delete document");
      }
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const handleViewDocument = (document: Document) => {
    setViewDocument(document);
  };

  const handleUpdateDocument = async (id: string, updatedContent: string) => {
    if (!currentWorkspace?.id) return;

    try {
      const response = await documentApi.update(currentWorkspace.id, id, {
        contentText: updatedContent,
      });

      if (response.success) {
        toast.success("Document updated successfully!");
        await loadDocuments();

        // Update the viewDocument state with the new content
        setViewDocument(prev => prev ? { ...prev, content_text: updatedContent } : null);
      } else {
        throw new Error(response.error || "Update failed");
      }
    } catch (error: any) {
      console.error("Error updating document:", error);
      toast.error("Failed to update document");
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

      {workspaceLimits?.documentUpload && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${!workspaceLimits.documentUpload.canUpload
                  ? "bg-red-50"
                  : workspaceLimits.documentUpload.remaining <= 2 && workspaceLimits.documentUpload.limit !== 0
                    ? "bg-yellow-50"
                    : "bg-blue-50"
                  }`}
              >
                <AlertCircle
                  className={`w-6 h-6 ${!workspaceLimits.documentUpload.canUpload
                    ? "text-red-600"
                    : workspaceLimits.documentUpload.remaining <= 2 && workspaceLimits.documentUpload.limit !== 0
                      ? "text-yellow-600"
                      : "text-blue-600"
                    }`}
                />
              </div>
              <div>
                <h3
                  className={`text-lg font-semibold ${!workspaceLimits.documentUpload.canUpload
                    ? "text-red-900"
                    : workspaceLimits.documentUpload.remaining <= 2 && workspaceLimits.documentUpload.limit !== 0
                      ? "text-yellow-900"
                      : "text-blue-900"
                    }`}
                >
                  {!workspaceLimits.documentUpload.canUpload
                    ? "Document Limit Reached"
                    : workspaceLimits.documentUpload.limit === 0
                      ? "Unlimited Documents"
                      : workspaceLimits.documentUpload.remaining <= 2
                        ? "Document Limit Warning"
                        : "Document Usage"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p
                    className={`text-sm ${!workspaceLimits.documentUpload.canUpload
                      ? "text-red-700"
                      : workspaceLimits.documentUpload.remaining <= 2 && workspaceLimits.documentUpload.limit !== 0
                        ? "text-yellow-700"
                        : "text-blue-700"
                      }`}
                  >
                    {workspaceLimits.documentUpload.limit === 0
                      ? `You have unlimited document uploads on the ${workspaceLimits.documentUpload.planType} plan.`
                      : `You have used ${workspaceLimits.documentUpload.currentCount} of ${workspaceLimits.documentUpload.limit} document slots.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {workspaceLimits.documentUpload.limit !== 0 && (
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${!workspaceLimits.documentUpload.canUpload
                  ? "bg-red-600"
                  : workspaceLimits.documentUpload.remaining <= 2
                    ? "bg-yellow-500"
                    : "bg-blue-600"
                  }`}
                style={{
                  width: `${Math.min(
                    (workspaceLimits.documentUpload.currentCount /
                      workspaceLimits.documentUpload.limit) *
                    100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          )}

          {(!workspaceLimits.documentUpload.canUpload ||
            (workspaceLimits.documentUpload.remaining <= 2 &&
              workspaceLimits.documentUpload.limit !== 0)) && (
              <div
                className={`mt-4 p-3 rounded-lg border ${!workspaceLimits.documentUpload.canUpload
                  ? "bg-red-50 border-red-200"
                  : "bg-yellow-50 border-yellow-200"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle
                    className={`w-4 h-4 ${!workspaceLimits.documentUpload.canUpload
                      ? "text-red-600"
                      : "text-yellow-600"
                      } flex-shrink-0`}
                  />
                  <p
                    className={`text-sm ${!workspaceLimits.documentUpload.canUpload
                      ? "text-red-800"
                      : "text-yellow-800"
                      }`}
                  >
                    {!workspaceLimits.documentUpload.canUpload
                      ? "You've reached your document limit. "
                      : `Only ${workspaceLimits.documentUpload.remaining} document${workspaceLimits.documentUpload.remaining === 1 ? "" : "s"
                      } left. `}
                    <button
                      onClick={() => (window.location.href = "/subscription")}
                      className={`font-semibold underline hover:${!workspaceLimits.documentUpload.canUpload
                        ? "text-red-900"
                        : "text-yellow-900"
                        } transition`}
                    >
                      Upgrade to Pro
                    </button>{" "}
                    for unlimited documents.
                  </p>
                </div>
              </div>
            )}
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
                onDelete={() => handleDeleteDocument(doc.id, doc.title)}
                onView={() => handleViewDocument(doc)}
              />
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}

      {showUpgradeModal && workspaceLimits?.documentUpload && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentLimit={workspaceLimits.documentUpload.limit}
          currentCount={workspaceLimits.documentUpload.currentCount}
          planType={workspaceLimits.documentUpload.planType}
        />
      )}

      {deleteConfirmation && (
        <DeleteConfirmationModal
          title={deleteConfirmation.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
        />
      )}

      {viewDocument && (
        <ViewDocumentModal
          document={viewDocument}
          onClose={() => setViewDocument(null)}
          onUpdate={handleUpdateDocument}
        />
      )}
    </div>
  );
}

function DocumentRow({
  document,
  onDelete,
  onView,
}: {
  document: Document;
  onDelete: () => void;
  onView: () => void;
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
              <button
                onClick={() => {
                  setShowMenu(false);
                  onView();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
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
  onUpload,
  uploading,
}: {
  onClose: () => void;
  onUpload: (data: { type: 'text' | 'file'; content?: string; title?: string; file?: File }) => Promise<void>;
  uploading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'text' && title && text) {
      onUpload({ type: 'text', content: text, title });
    } else if (activeTab === 'file' && file) {
      onUpload({ type: 'file', file, title: title || file.name });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
          <p className="text-gray-600 mt-1">
            Add content by uploading a file or pasting text
          </p>
        </div>

        <div className="px-6 pt-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`pb-3 px-4 font-medium text-sm transition-colors relative ${activeTab === 'text'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
              onClick={() => setActiveTab('text')}
            >
              Paste Text
            </button>
            <button
              className={`pb-3 px-4 font-medium text-sm transition-colors relative ${activeTab === 'file'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
              onClick={() => setActiveTab('file')}
            >
              Upload File
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title {activeTab === 'file' && '(Optional)'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={activeTab === 'file' ? "Defaults to filename" : "Enter a title"}
                required={activeTab === 'text'}
              />
            </div>

            {activeTab === 'text' ? (
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
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File (PDF, DOCX, TXT)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition cursor-pointer relative"
                >
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          ref={fileInputRef}
                          className="sr-only"
                          accept=".pdf,.docx,.txt"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PDF, DOCX, TXT up to 50MB
                    </p>
                    {file && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 py-2 px-4 rounded-full">
                        <FileText className="w-4 h-4" />
                        {file.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={uploading || (activeTab === 'text' && (!title || !text)) || (activeTab === 'file' && !file)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading ? "Saving..." : "Save Content"}
            </button>
          </div>
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
  planType,
}: {
  onClose: () => void;
  currentLimit: number;
  currentCount: number;
  planType: string;
}) {
  const displayLimit = currentLimit === 0 ? "Unlimited" : currentLimit;
  const progressPercent =
    currentLimit === 0 ? 100 : (currentCount / currentLimit) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade Plan</h2>
        <p className="text-gray-600 mb-4">
          {planType.charAt(0).toUpperCase() + planType.slice(1)} plan: {displayLimit}{" "}
          document{displayLimit === 1 ? "" : "s"}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-red-600 h-2 rounded-full"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <p className="text-gray-700 mb-4">
          You have used {currentCount} document{currentCount === 1 ? "" : "s"}.
          Upgrade to Pro for unlimited uploads.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            onClick={() => (window.location.href = "/subscription")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmationModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Delete Document?</h2>
            <p className="text-gray-500 text-sm mt-1">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-gray-600 mb-8">
          Are you sure you want to delete <span className="font-semibold text-gray-900">"{title}"</span>? This will permanently remove the document from your library.
        </p>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition flex items-center justify-center gap-2 font-medium order-1 sm:order-2"
          >
            <Trash2 className="w-5 h-5" />
            Delete Document
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewDocumentModal({
  document,
  onClose,
  onUpdate,
}: {
  document: Document;
  onClose: () => void;
  onUpdate: (id: string, content: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(document.content_text || "");
  const [isSaving, setIsSaving] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(document.id, editedContent);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(document.content_text || "");
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{document.title}</h2>
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
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {document.content_text || isEditing ? (
            <div className="w-full h-full">
              {isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-full min-h-[400px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-sans text-gray-700 leading-relaxed"
                  placeholder="Enter your document content here..."
                />
              ) : (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                    {document.content_text}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No content available
              </h3>
              <p className="text-gray-600 mb-4">
                This document doesn't have any text content yet.
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit className="w-4 h-4" />
                Add Content
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}