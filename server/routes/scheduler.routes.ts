import express from "express";
import { schedulerController } from "../controllers/scheduler.controller";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.post("/publish-now", authenticate,async (req, res) => {
  await schedulerController.publishNow(req, res);
});

export default router;
