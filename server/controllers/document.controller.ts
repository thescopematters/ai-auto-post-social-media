// @ts-nocheck
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { successResponse, paginatedResponse } from "../utils/response";
import logger from "../config/logger";
import {
  checkDocumentUploadLimit,
  incrementUsage,
  // 1. IMPORT the new function
  decrementUsage 
} from "../utils/limitCheck";


// ====================================================================================
// GET ALL DOCUMENTS
// ====================================================================================
export const getAllDocuments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    console.log(">>>> workspace", workspaceId)

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("documents")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("uploaded_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Error fetching documents:", error);
      throw new Error("Failed to fetch documents");
    }

    paginatedResponse(
      res,
      data || [],
      page,
      limit,
      count || 0,
      "Documents retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// GET DOCUMENT BY ID
// ====================================================================================
export const getDocumentById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, documentId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Document not found");
    }

    successResponse(res, data, "Document retrieved successfully");
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// CREATE DOCUMENT (WITH LIMIT CHECK)
// ====================================================================================
export const createDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;
    const { title, fileType, fileUrl, contentText, metadata } = req.body;

    if (!req.user) {
      throw new AuthorizationError("User not authenticated");
    }

    // ------------------------------
    // Check plan-based document limit
    // ------------------------------
    const limitCheck = await checkDocumentUploadLimit(req.user.id);

    if (!limitCheck.canUpload) {
      logger.warn("Document upload blocked due to limit:", {
        userId: req.user.id,
        message: limitCheck.message,
      });
      return next(new Error(limitCheck.message || "Document upload limit exceeded"));
    }

    // ------------------------------
    // Create the new document record
    // ------------------------------
    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert({
        workspace_id: workspaceId,
        uploaded_by: req.user.id,
        title,
        file_type: fileType,
        file_url: fileUrl,
        content_text: contentText,
        file_size: contentText ? contentText.length : 0,
        metadata: metadata || {},
        processing_status: contentText ? "completed" : "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Document creation error:", error);
      throw new Error("Failed to create document");
    }

    // ------------------------------
    // Increment user's document usage count
    // ------------------------------
    await incrementUsage({
      type: "document", // Specify the type of usage
      userId: req.user.id,
    });

    successResponse(res, data, "Document created successfully", 201);
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// UPDATE DOCUMENT
// ====================================================================================
export const updateDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, documentId } = req.params;
    const { title, contentText, metadata, processingStatus } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (contentText) updateData.content_text = contentText;
    if (metadata) updateData.metadata = metadata;
    if (processingStatus) updateData.processing_status = processingStatus;

    const { data, error } = await supabaseAdmin
      .from("documents")
      .update(updateData)
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError("Document not found");
    }

    successResponse(res, data, "Document updated successfully");
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// DELETE DOCUMENT
// ====================================================================================
export const deleteDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, documentId } = req.params;

    const { error } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new NotFoundError("Document not found");
    }
    
    // 2. CALL the new decrement function
    if (req.user) {
        await decrementUsage({
            type: "document",
            userId: req.user.id,
        });
    }

    successResponse(res, null, "Document deleted successfully");
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// DOCUMENT STATS
// ====================================================================================
export const getDocumentStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("processing_status")
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error("Failed to fetch document stats");
    }

    const stats = {
      total: data?.length || 0,
      completed: data?.filter((d) => d.processing_status === "completed").length || 0,
      processing: data?.filter((d) => d.processing_status === "processing").length || 0,
      pending: data?.filter((d) => d.processing_status === "pending").length || 0,
      failed: data?.filter((d) => d.processing_status === "failed").length || 0,
    };

    successResponse(res, stats, "Document statistics retrieved successfully");
  } catch (error) {
    next(error);
  }
};


// ====================================================================================
// CHECK DOCUMENT LIMITS (PLAN VALIDATION)
// ====================================================================================
export const checkDocumentUploadLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthorizationError("User not authenticated");
    }

    const limitCheck = await 
    (req.user.id);

    const remaining =
      limitCheck.limit === 0
        ? "unlimited"
        : Math.max(limitCheck.limit - limitCheck.currentCount, 0);

    successResponse(
      res,
      {
        canUpload: limitCheck.canUpload,
        message: limitCheck.message,
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        remaining,
        planType: limitCheck.planType,
      },
      "Document upload limits retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};