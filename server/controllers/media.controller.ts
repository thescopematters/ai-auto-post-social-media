import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import supabaseAdmin from "../config/database";
import { NotFoundError, ValidationError } from "../utils/errors";
import { successResponse } from "../utils/response";
import logger from "../config/logger";
import { v4 as uuidv4 } from "uuid";
import { Database } from "../types/database.types";
import AWSS3Service from "../services/awsS3.service";

// 🧩 Typed aliases
type MediaStatus = "active" | "inactive" | "deleted";
type PostMediaInsert = Database["public"]["Tables"]["post_media"]["Insert"];
type PostMediaUpdate = Database["public"]["Tables"]["post_media"]["Update"];
type PostMediaRow = Database["public"]["Tables"]["post_media"]["Row"];

/* =========================================================================
   UPLOAD MEDIA
   ========================================================================= */
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
    // Ensure files is typed correctly. Multer typing can be tricky.
    const files = (Array.isArray(req.files) ? req.files : [req.files]) as Express.Multer.File[];

    // Verify post exists
    const { data: post, error: postError } = await supabaseAdmin
      .from("generated_posts")
      .select("id, workspace_id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) throw new NotFoundError("Post not found");

    const uploadedMedias: PostMediaRow[] = [];
    const failedUploads: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const fileType = getFileType(file.mimetype);
        if (!fileType) {
          failedUploads.push({ filename: file.originalname, error: `Unsupported file type` });
          continue;
        }

        // Upload to S3
        const s3Path = `workspaces/${workspaceId}/posts/${postId}/${file.originalname}`;
        const s3Url = await AWSS3Service.uploadFile(
          { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size },
          // Note: The uploadFile service may return a full URL or just a path. 
          s3Path 
        );

        const mediaData = {
          id: uuidv4(),
          workspace_id: workspaceId,
          post_id: postId,
          media_path: s3Url, 
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          type: fileType,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Casting the input array to `any`
        const { data: mediaRecord, error: mediaError } = await supabaseAdmin
          .from("post_media")
          .insert([mediaData] as any) 
          .select('*') 
          .single<PostMediaRow>();

        if (mediaError || !mediaRecord) {
          const errorMsg = mediaError?.message || "Unknown error";
          logger.error(
            `Failed to create media record: ${errorMsg}`,
            mediaError
          );

          // Delete from S3 if database insert fails
          try {
            await AWSS3Service.deleteFile(s3Url);
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

    if (uploadedMedias.length === 0) {
      throw new ValidationError(
        `No files uploaded. Errors: ${failedUploads.map(f => `${f.filename}: ${f.error}`).join("; ")}`
      );
    }

    successResponse(res, {
      uploadedMedia: uploadedMedias,
      totalMedia: uploadedMedias.length,
      failedUploads: failedUploads.length ? failedUploads : undefined,
    }, uploadedMedias.length === files.length ? "All media uploaded successfully" : `${uploadedMedias.length} of ${files.length} uploaded successfully`);
  } catch (error) {
    logger.error("Media upload error:", error);
    next(error);
  }
};

/* =========================================================================
   GET POST MEDIA
   ========================================================================= */
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
        "id, workspace_id, post_id, media_path, file_name, file_size, mime_type, type, status, created_at, updated_at"
      )
      .eq("post_id", postId)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("created_at", { ascending: false});
      
    if (error) throw new Error(error.message);

    type MediaRowSelect = Pick<PostMediaRow, "id" | "workspace_id" | "post_id" | "media_path" | "file_name" | "file_size" | "mime_type" | "type" | "status" | "created_at" | "updated_at">;
    const mediaRows = media as MediaRowSelect[];

    successResponse(res, mediaRows || [], "Media retrieved successfully");
  } catch (error) {
    logger.error("Get media error:", error);
    next(error);
  }
};

/* =========================================================================
   DELETE MEDIA
   ========================================================================= */
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
      .single<Pick<PostMediaRow, "media_path" | "status">>(); 

    if (fetchError || !media) throw new NotFoundError("Media not found");

    if (media.media_path) {
      await AWSS3Service.deleteFile(media.media_path).catch((err) =>
        logger.warn(`Failed to delete from S3: ${err}`)
      );
    }

    const updatePayload: PostMediaUpdate = { status: "deleted", updated_at: new Date().toISOString() };

    /// FIX 2: Casting the entire table selection to `any` before update
    const { error: deleteError } = await (supabaseAdmin.from("post_media") as any)
      .update(updatePayload) // No 'as any' needed on payload
      .eq("id", mediaId);

    if (deleteError) throw new Error(deleteError.message);

    successResponse(res, null, "Media deleted successfully");
  } catch (error) {
    logger.error("Delete media error:", error);
    next(error);
  }
};

/* =========================================================================
   UPDATE MEDIA STATUS
   ========================================================================= */
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
      throw new ValidationError(`Invalid status. Use one of: ${validStatuses.join(", ")}`);
    }

    const updatePayload: PostMediaUpdate = { status, updated_at: new Date().toISOString() };
    
    type MediaResult = Pick<PostMediaRow, "id" | "post_id" | "media_path" | "type" | "status">;

    // FIX 3: Casting the update payload to `any` (Line 216)
    // FIX 3: Casting the entire table selection to `any` before update
const { data: media, error } = await (supabaseAdmin as any)
      .from("post_media")
      .update(updatePayload) // Minimal cast to clear 'never' (2345)
      .match({ id: mediaId, post_id: postId, workspace_id: workspaceId })
      .select("id, post_id, media_path, type, status") 
      .single(); // Removed generic <MediaResult> to clear 'untyped function' (2347)

    if (error) throw new Error(error.message);

    // Cast the retrieved data to the desired type for the response
    successResponse(res, media as MediaResult, "Media status updated successfully");
  } catch (error) {
    logger.error("Update media status error:", error);
    next(error);
  }
};

/* =========================================================================
   HELPERS
   ========================================================================= */
function getFileType(mimetype: string): "img" | "pdf" | "doc" | null {
  if (mimetype.startsWith("image/")) return "img";
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.includes("document") || mimetype.includes("msword") || mimetype.includes("wordprocessingml")) return "doc";
  return null;
}