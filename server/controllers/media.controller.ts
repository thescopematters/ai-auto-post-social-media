import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError, ValidationError } from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";
import { v4 as uuidv4 } from "uuid";
import AWSS3Service from "../services/awsS3.service";

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

export const uploadPostMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info("Upload request received", {
      hasFiles: !!req.files,
      filesType: Array.isArray(req.files) ? "array" : typeof req.files,
      filesLength: Array.isArray(req.files) ? req.files.length : 0,
    });

    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      throw new ValidationError("No media files provided");
    }

    const { workspaceId, postId } = req.params;
    logger.info(
      `Processing upload for workspace: ${workspaceId}, post: ${postId}`
    );

    const files = (
      Array.isArray(req.files) ? req.files : [req.files]
    ) as Express.Multer.File[];

    logger.info(`Processing ${files.length} file(s)`);

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

    const failedUploads: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        logger.info(`Processing file: ${file.originalname}`, {
          mimetype: file.mimetype,
          size: file.size,
          hasBuffer: !!file.buffer,
        });

        if (!file.mimetype) {
          const error = `Invalid file type for: ${file.originalname}`;
          logger.warn(error);
          failedUploads.push({ filename: file.originalname, error });
          continue;
        }

        const fileType = getFileType(file.mimetype);
        if (!fileType) {
          const error = `Unsupported file type: ${file.mimetype}`;
          logger.warn(error);
          failedUploads.push({ filename: file.originalname, error });
          continue;
        }

        // Upload to S3
        logger.info(`Uploading file to S3: ${file.originalname}`);
        const s3Url = await AWSS3Service.uploadFile(
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
          `workspaces/${workspaceId}/posts/${postId}`
        );

        logger.info(`File uploaded to S3: ${s3Url}`);

        const mediaData = {
          id: uuidv4(),
          workspace_id: workspaceId,
          post_id: postId,
          media_path: s3Url,
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
          const errorMsg = mediaError?.message || "Unknown error";
          logger.error(
            `Failed to create media record: ${errorMsg}`,
            mediaError
          );

          // Delete from S3 if database insert fails
          try {
            await AWSS3Service.deleteFile(s3Url);
            logger.info(`Cleaned up S3 file after DB error: ${s3Url}`);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup S3 file: ${cleanupError}`);
          }

          failedUploads.push({
            filename: file.originalname,
            error: `Database error: ${errorMsg}`,
          });
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

        logger.info(`✅ Successfully processed: ${file.originalname}`);
      } catch (fileError: unknown) {
        const errorMessage =
          fileError instanceof Error
            ? fileError.message
            : "Unknown error occurred";
        logger.error(
          `Error processing file ${file.originalname}: ${errorMessage}`,
          fileError
        );
        failedUploads.push({
          filename: file.originalname,
          error: errorMessage,
        });
      }
    }

    // Log summary
    logger.info("Upload summary:", {
      total: files.length,
      successful: uploadedMedias.length,
      failed: failedUploads.length,
      failedFiles: failedUploads,
    });

    if (uploadedMedias.length === 0) {
      logger.error(`No files were successfully uploaded`, {
        failedUploads,
      });
      throw new ValidationError(
        `No files were successfully uploaded. Errors: ${failedUploads
          .map((f) => `${f.filename}: ${f.error}`)
          .join("; ")}`
      );
    }

    const mediaPaths = uploadedMedias.map((media) => media.media_path);

    // Check if any uploaded media is an image
    const hasImage = uploadedMedias.some((media) => media.type === "img");

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
      logger.info(
        `Generated post updated with ${mediaPaths.length} media URLs`
      );
    }

    successResponse(
      res,
      {
        uploadedMedia: uploadedMedias,
        totalMedia: uploadedMedias.length,
        failedUploads: failedUploads.length > 0 ? failedUploads : undefined,
      },
      uploadedMedias.length === files.length
        ? "All media uploaded successfully to S3"
        : `${uploadedMedias.length} of ${files.length} files uploaded successfully`,
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

    // Delete from S3
    if (media.media_path) {
      try {
        const deleted = await AWSS3Service.deleteFile(media.media_path);
        if (deleted) {
          logger.info(`Successfully deleted file from S3: ${media.media_path}`);
        } else {
          logger.warn(`Failed to delete file from S3: ${media.media_path}`);
        }
      } catch (s3Error) {
        logger.warn(`S3 deletion error: ${s3Error}`);
        // Continue even if S3 deletion fails
      }
    }

    // Mark as deleted in database
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

    successResponse(res, null, "Media deleted successfully from S3", 200);
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
