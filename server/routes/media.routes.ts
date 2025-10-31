import { Router } from "express";
import { param } from "express-validator";
import * as mediaController from "../controllers/media.controller";
import { validate } from "../middleware/validation";
import { authenticate, requireWorkspace, requireRole } from "../middleware/auth";
import { upload } from "../utils/fileUpload";

const router = Router();

router.use(authenticate);

router.post(
  "/:workspaceId/posts/:postId/media",
  upload.array("media", 5),
  validate([
    param("workspaceId").isUUID().withMessage("Invalid workspace ID"),
    param("postId").isUUID().withMessage("Invalid post ID"),
  ]),
  requireWorkspace,
  requireRole(["admin", "editor"]),
  mediaController.uploadPostMedia
);

router.get(
  "/:workspaceId/posts/:postId/media",
  validate([
    param("workspaceId").isUUID().withMessage("Invalid workspace ID"),
    param("postId").isUUID().withMessage("Invalid post ID"),
  ]),
  requireWorkspace,
  mediaController.getPostMedia
);

router.delete(
  "/:workspaceId/posts/:postId/media/:mediaId",
  validate([
    param("workspaceId").isUUID().withMessage("Invalid workspace ID"),
    param("postId").isUUID().withMessage("Invalid post ID"),
    param("mediaId").isUUID().withMessage("Invalid media ID"),
  ]),
  requireWorkspace,
  requireRole(["admin", "editor"]),
  mediaController.deletePostMedia
);

export default router;