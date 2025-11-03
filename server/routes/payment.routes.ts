// src/routes/payment.routes.ts
import { Router, text } from "express";
import express from "express";
import * as paymentController from "../controllers/phone-pay";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post(
  "/createorder",
  authenticate,               
  paymentController.createOrder
);

router.get(
  "/history",
  authenticate,
  paymentController.getPaymentHistory
);
router.get("/checkstatus/:merchantTransactionId", paymentController.checkStatus);

export default router;
