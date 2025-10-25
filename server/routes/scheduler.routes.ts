import express from "express";
import { schedulerController } from "../controllers/scheduler.controller";

const router = express.Router();

// Manual trigger route for testing
router.post("/publish-now", async (req, res) => {
  await schedulerController.manualPublish(req, res);
});

export default router;
