import { Request, Response } from 'express';
import { S3Service } from '../services/s3.service';
import { URLExtractorService } from '../services/url-extractor.service';
import supabaseAdmin from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export class DocumentsController {
  static async uploadFile(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const userId = (req as any).user?.id;

      if (!req.file) {
        return errorResponse(res, 'No file provided', 400);
      }

      const file = req.file;

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        return errorResponse(res, 'File size exceeds 50MB limit', 400);
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/markdown',
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return errorResponse(res, 'File type not supported', 400);
      }

      // Upload to S3
      const { key, url } = await S3Service.uploadFile(
        file.buffer,
        file.originalname,
        workspaceId,
        file.mimetype
      );

      // Extract text content from file
      let contentText = '';
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
        contentText = file.buffer.toString('utf-8');
      }

      // Store metadata in database
      const { data: document, error } = await (supabaseAdmin as any)
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          title: file.originalname,
          file_type: file.mimetype,
          file_url: url,
          s3_key: key,
          content_text: contentText,
          upload_method: 'file',
          metadata: {
            size: file.size,
            originalName: file.originalname,
            uploadedBy: userId,
          },
        })
        .select()
        .single();

      if (error) {
        // Rollback S3 upload
        await S3Service.deleteFile(key);
        throw error;
      }

      return successResponse(res, document, 'File uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      return errorResponse(res, 'Failed to upload file', 500);
    }
  }

  static async uploadFromUrl(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { url } = req.body;

      if (!url) {
        return errorResponse(res, 'URL is required', 400);
      }

      // Validate URL
      if (!URLExtractorService.validateUrl(url)) {
        return errorResponse(res, 'Invalid URL format', 400);
      }

      // Extract content from URL
      const { title, content, metadata } = await URLExtractorService.extractContent(url);

      // Store in database
      const { data: document, error } = await (supabaseAdmin as any)
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          title: title || 'Untitled Document',
          file_type: 'url',
          source_url: url,
          content_text: content,
          upload_method: 'url',
          metadata,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return successResponse(res, document, 'Content extracted from URL successfully');
    } catch (error) {
      console.error('URL extraction error:', error);
      return errorResponse(
        res,
        error instanceof Error ? error.message : 'Failed to extract content from URL',
        500
      );
    }
  }

  static async uploadFromText(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { title, content } = req.body;

      if (!title || !content) {
        return errorResponse(res, 'Title and content are required', 400);
      }

      // Validate content length
      if (content.length > 50000) {
        return errorResponse(res, 'Content exceeds 50,000 character limit', 400);
      }

      // Store in database
      const { data: document, error } = await (supabaseAdmin as any)
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          title,
          file_type: 'text',
          content_text: content,
          upload_method: 'text',
          metadata: {
            characterCount: content.length,
            wordCount: content.split(/\s+/).length,
          },
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return successResponse(res, document, 'Text document created successfully');
    } catch (error) {
      console.error('Text upload error:', error);
      return errorResponse(res, 'Failed to create text document', 500);
    }
  }

  static async getDocuments(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { page = 1, limit = 20, search = '' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = (supabaseAdmin as any)
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (search) {
        query = query.or(`title.ilike.%${search}%,content_text.ilike.%${search}%`);
      }

      const { data: documents, error, count } = await query;

      if (error) {
        throw error;
      }

      const totalPages = Math.ceil((count || 0) / limitNum);

      return successResponse(
        res,
        documents,
        'Documents retrieved successfully',
        200,
        {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages,
        }
      );
    } catch (error) {
      console.error('Get documents error:', error);
      return errorResponse(res, 'Failed to retrieve documents', 500);
    }
  }

  static async getDocument(req: Request, res: Response) {
    try {
      const { workspaceId, documentId } = req.params;

      const { data: document, error } = await (supabaseAdmin as any)
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error || !document) {
        return errorResponse(res, 'Document not found', 404);
      }

      // If document is stored in S3, generate signed download URL
      if (document.s3_key) {
        const downloadUrl = await S3Service.getSignedDownloadUrl(document.s3_key, 3600);
        document.download_url = downloadUrl;
      }

      return successResponse(res, document, 'Document retrieved successfully');
    } catch (error) {
      console.error('Get document error:', error);
      return errorResponse(res, 'Failed to retrieve document', 500);
    }
  }

  static async updateDocument(req: Request, res: Response) {
    try {
      const { workspaceId, documentId } = req.params;
      const { title, content_text } = req.body;

      const updates: any = {};
      if (title) updates.title = title;
      if (content_text !== undefined) updates.content_text = content_text;
      updates.updated_at = new Date().toISOString();

      const { data: document, error } = await (supabaseAdmin as any)
        .from('documents')
        .update(updates)
        .eq('id', documentId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error || !document) {
        return errorResponse(res, 'Document not found', 404);
      }

      return successResponse(res, document, 'Document updated successfully');
    } catch (error) {
      console.error('Update document error:', error);
      return errorResponse(res, 'Failed to update document', 500);
    }
  }

  static async deleteDocument(req: Request, res: Response) {
    try {
      const { workspaceId, documentId } = req.params;

      // Get document to check for S3 key
      const { data: document, error: fetchError } = await (supabaseAdmin as any)
        .from('documents')
        .select('s3_key')
        .eq('id', documentId)
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchError || !document) {
        return errorResponse(res, 'Document not found', 404);
      }

      // Delete from S3 if exists
      if (document.s3_key) {
        try {
          await S3Service.deleteFile(document.s3_key);
        } catch (s3Error) {
          console.error('S3 deletion error:', s3Error);
          // Continue with database deletion even if S3 fails
        }
      }

      // Delete from database
      const { error: deleteError } = await (supabaseAdmin as any)
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('workspace_id', workspaceId);

      if (deleteError) {
        throw deleteError;
      }

      return successResponse(res, null, 'Document deleted successfully');
    } catch (error) {
      console.error('Delete document error:', error);
      return errorResponse(res, 'Failed to delete document', 500);
    }
  }

  static async getDocumentStats(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;

      const { count: totalCount } = await (supabaseAdmin as any)
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      const { count: fileCount } = await (supabaseAdmin as any)
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('upload_method', 'file');

      const { count: urlCount } = await (supabaseAdmin as any)
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('upload_method', 'url');

      const { count: textCount } = await (supabaseAdmin as any)
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('upload_method', 'text');

      const stats = {
        total: totalCount || 0,
        byMethod: {
          file: fileCount || 0,
          url: urlCount || 0,
          text: textCount || 0,
        },
      };

      return successResponse(res, stats, 'Document stats retrieved successfully');
    } catch (error) {
      console.error('Get document stats error:', error);
      return errorResponse(res, 'Failed to retrieve document stats', 500);
    }
  }
}
