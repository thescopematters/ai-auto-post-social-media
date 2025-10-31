import express from "express";
import { schedulerController } from "../controllers/scheduler.controller";

const router = express.Router();

router.post("/publish-now", async (req, res) => {
  await schedulerController.publishNow(req, res);
});

export default router;
