import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError, ValidationError } from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

type MediaStatus = "active" | "inactive" | "deleted";

interface MediaRecord {
  id: string;
  workspace_id: string;
  post_id: string;
  media_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  type: string;
  status: MediaStatus;
  created_at: string;
  updated_at: string;
}

// Create upload directory if it doesn't exist
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "media");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadPostMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      throw new ValidationError("No media files provided");
    }

    const { workspaceId, postId } = req.params;

    const files = (
      Array.isArray(req.files) ? req.files : [req.files]
    ) as Express.Multer.File[];

    // Verify post exists
    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id, workspace_id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      logger.error(`Post not found: ${postId}`, postError);
      throw new NotFoundError("Post not found");
    }

    const uploadedMedias: Array<{
      post_media_id: string;
      post_id: string;
      media_path: string;
      type: string;
      status: string;
      file_name: string;
    }> = [];

    for (const file of files) {
      try {
        if (!file.mimetype) {
          logger.warn(`Invalid file type: ${file.originalname}`);
          continue;
        }

        const fileType = getFileType(file.mimetype);
        if (!fileType) {
          logger.warn(`Unsupported file type: ${file.mimetype}`);
          continue;
        }

        // Generate unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFileName);
        const relativePath = `/uploads/media/${uniqueFileName}`;

        // Save file locally
        try {
          fs.writeFileSync(filePath, file.buffer);
        } catch (writeError: any) {
          logger.error(`Failed to save file: ${writeError.message}`);
          continue;
        }

        const mediaData = {
          id: uuidv4(),
          workspace_id: workspaceId,
          post_id: postId,
          media_path: relativePath,
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          type: fileType,
          status: "active" as MediaStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: mediaRecord, error: mediaError } = await supabaseAdmin
          .from("post_media")
          .insert([mediaData])
          .select()
          .single<MediaRecord>();

        if (mediaError || !mediaRecord) {
          logger.error(
            `Failed to create media record: ${mediaError?.message || "Unknown error"}`,
            mediaError
          );
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup file: ${cleanupError}`);
          }
          continue;
        }

        uploadedMedias.push({
          post_media_id: mediaRecord.id,
          post_id: mediaRecord.post_id,
          media_path: mediaRecord.media_path,
          type: mediaRecord.type,
          status: mediaRecord.status,
          file_name: mediaRecord.file_name,
        });
      } catch (fileError: unknown) {
        const errorMessage =
          fileError instanceof Error
            ? fileError.message
            : "Unknown error occurred";
        logger.error(
          `Error processing file ${file.originalname}: ${errorMessage}`,
          fileError
        );
      }
    }

    if (uploadedMedias.length === 0) {
      logger.error(`No files were successfully uploaded`);
      throw new ValidationError("No files were successfully uploaded");
    }

    const mediaPaths = uploadedMedias.map((media) => media.media_path);

    const { error: updateError } = await supabaseAdmin
      .from("generated_posts")
      .update({
        media_urls: mediaPaths,
        updated_at: new Date().toISOString(),
      })
      .match({ id: postId, workspace_id: workspaceId });

    if (updateError) {
      logger.warn(
        `Failed to update post media_urls: ${updateError.message}`,
        updateError
      );
    } else {
      logger.info(`Generated post updated with media URLs`);
    }

    successResponse(
      res,
      {
        uploadedMedia: uploadedMedias,
        totalMedia: uploadedMedias.length,
      },
      "Media uploaded successfully",
      200
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error(`Media upload error: ${errorMessage}`, error);
    next(error);
  }
};

export const getPostMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId } = req.params;

    const { data: media, error } = await supabaseAdmin
      .from("post_media")
      .select(
        "id as post_media_id, post_id, media_path, file_name, file_size, type, status, created_at, updated_at"
      )
      .eq("post_id", postId)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch media: ${error.message}`);
    }

    successResponse(res, media || [], "Media retrieved successfully", 200);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Get media error:", errorMessage);
    next(error);
  }
};

export const deletePostMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId, mediaId } = req.params;

    const { data: media, error: fetchError } = await supabaseAdmin
      .from("post_media")
      .select("media_path, status")
      .eq("id", mediaId)
      .eq("post_id", postId)
      .eq("workspace_id", workspaceId)
      .single<{ media_path: string; status: MediaStatus }>();

    if (fetchError || !media) {
      throw new NotFoundError("Media not found");
    }

    // Delete local file
    if (media.media_path) {
      try {
        const fullPath = path.join(process.cwd(), media.media_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (unlinkError) {
        logger.warn(`Failed to delete local file: ${unlinkError}`);
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("post_media")
      .update({
        status: "deleted" as MediaStatus,
        updated_at: new Date().toISOString(),
      })
      .match({ id: mediaId });

    if (deleteError) {
      throw new Error(`Failed to delete media record: ${deleteError.message}`);
    }

    successResponse(res, null, "Media deleted successfully", 200);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Delete media error:", errorMessage);
    next(error);
  }
};

export const updateMediaStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { workspaceId, postId, mediaId } = req.params;
    const { status } = req.body;

    const validStatuses: MediaStatus[] = ["active", "inactive", "deleted"];

    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Invalid status. Use: ${validStatuses.join(", ")}`
      );
    }

    const { data: media, error } = await supabaseAdmin
      .from("post_media")
      .update({
        status: status as MediaStatus,
        updated_at: new Date().toISOString(),
      })
      .match({ id: mediaId, post_id: postId, workspace_id: workspaceId })
      .select("id as post_media_id, post_id, media_path, type, status")
      .single<{
        post_media_id: string;
        post_id: string;
        media_path: string;
        type: string;
        status: MediaStatus;
      }>();

    if (error) {
      throw new Error(`Failed to update media status: ${error.message}`);
    }

    successResponse(res, media, "Media status updated successfully", 200);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Update media status error:", errorMessage);
    next(error);
  }
};

function getFileType(mimetype: string): "img" | "pdf" | "doc" | null {
  if (mimetype.startsWith("image/")) return "img";
  if (mimetype === "application/pdf") return "pdf";
  if (
    mimetype.includes("document") ||
    mimetype.includes("msword") ||
    mimetype.includes("wordprocessingml")
  )
    return "doc";
  return null;
}