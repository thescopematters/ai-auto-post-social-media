// src/routes/payment.routes.ts
import { Router, text } from "express";
import express from "express";
import * as paymentController from "../controllers/phone-pay";
import { authenticate } from "../middleware/auth";
import path from "path";
import bodyParser from "body-parser";

const router = Router();

router.post(
  "/createorder",
  authenticate,               
  paymentController.createOrder);

router.get(
  "/history",
  authenticate,
  paymentController.getPaymentHistory
);

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  paymentController.webhook
);
router.get("/checkstatus/:merchantTransactionId", paymentController.checkStatus);

export default router;