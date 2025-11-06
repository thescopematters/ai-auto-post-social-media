import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../config/database";
import { randomUUID } from "crypto";
import { PhonePeException, StandardCheckoutPayRequest } from "pg-sdk-node";
import { Request, Response } from "express";
import { Database } from "../types/database.types";
import { phonePayClient } from "../config/phonepe.client";
import dotenv from "dotenv";
import { PassThrough } from "stream";

dotenv.config();

type TransactionInsert = Database["public"]["Tables"]["payment_transactions"]["Insert"];
type PaymentTransaction = Database["public"]["Tables"]["payment_transactions"]["Row"];

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: "Unauthorized" });

    const userId = req.user.id;
    const { amount } = req.body;
    const merchantTransactionId = randomUUID();

    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: "Invalid amount" });

    const insertPayload: TransactionInsert = {
      user_id: userId,
      merchant_transaction_id: merchantTransactionId,
      amount,
      status: "PENDING",
    };

    const { error: dbError } = await supabaseAdmin
      .from("payment_transactions")
      .insert(insertPayload as any);

    if (dbError) throw new Error(dbError.message);

    const payload = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantTransactionId)
      .amount(amount * 100) // Amount in paise
      .redirectUrl(
        process.env.PHONEPE_REDIRECT_URL ||
        `${process.env.FRONTEND_URL}/subscription?merchantTransactionId=${merchantTransactionId}`
      )
      .build();

    const response = await phonePayClient.pay(payload);

    if (!response.redirectUrl) {
      throw new Error("Failed to get redirect URL from PhonePe");
    }

    return res.status(200).json({
      success: true,
      redirectUrl: response.redirectUrl,
      merchantTransactionId,
    });
  } catch (err: any) {
    console.error("Payment Order Creation Failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { limit = 20 } = req.query as { limit?: any };
    const parsedLimit =
      Number(limit) > 0 && Number(limit) <= 100 ? Number(limit) : 20;

    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, merchant_transaction_id, amount, status, created_at")
      .eq("user_id", req.user.id)
      .in("status", ["COMPLETED", "FAILED"]) // ✅ filter for completed or failed only
      .order("created_at", { ascending: false })
      .limit(parsedLimit);

    if (error) {
      console.error("Supabase getPaymentHistory error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("getPaymentHistory failed:", err.message, err.stack);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// ✅ Check Payment Status (for frontend to call)
export const checkStatus = async (req: Request, res: Response) => {
  try {
    const { merchantTransactionId } = req.params;
    if (!merchantTransactionId) return res.status(400).json({ success: false, message: "Transaction ID required" });

    const { data: transaction, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("merchant_transaction_id", merchantTransactionId)
      .single<PaymentTransaction>();

    if (error) throw new Error(error.message);
    if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found" });

    // Only fetch status from PhonePe if pending
    if (transaction.status === "PENDING") {
      const response = await phonePayClient.getOrderStatus(merchantTransactionId);
      const newStatus = response?.state?.toUpperCase?.() || "FAILED";
      console.log("response>>>>",response)

      const { error: updateError } = await (supabaseAdmin as any)
        .from("payment_transactions")
        .update({ status: newStatus })
        .eq("merchant_transaction_id", merchantTransactionId);

      if (updateError) throw new Error(updateError.message);

      transaction.status = newStatus;
    }
    console.log("transaction >>", transaction)

    return res.status(200).json({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      transactionId: transaction.merchant_transaction_id,
    });
  } catch (err: any) {
    console.error("Check status failed:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    // --- 1️⃣ Extract raw body properly ---
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    const rawBodyString = rawBody.toString("utf8");

    const authHeader = req.headers["authorization"] as string;
    console.log("Auth header:", authHeader);
    console.log("Is Buffer:", req.body instanceof Buffer);
    console.log("Raw body string:", rawBodyString);

    // --- 2️⃣ Skip validation in development ---
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Skipping PhonePe callback validation in development mode");
      return res.status(200).json({
        success: true,
        message: "Webhook received (validation skipped in dev)",
        data: req.body,
      });
    }

    // --- 3️⃣ Validate callback in production ---
    const USERNAME = process.env.PHONEPE_WEBHOOK_USERNAME!;
    const PASSWORD = process.env.PHONEPE_WEBHOOK_PASSWORD!;

    if (!USERNAME || !PASSWORD) {
      console.error("❌ Missing PhonePe webhook credentials");
      return res.status(500).json({ success: false, message: "Server misconfigured (missing credentials)" });
    }

    const callbackResponse = phonePayClient.validateCallback(
      USERNAME,
      PASSWORD,
      authHeader,
      rawBody
    );

    if (callbackResponse) {
      console.log("✅ Webhook validated successfully:", callbackResponse);
      return res.status(200).json({
        success: true,
        message: "Webhook received and validated",
        data: callbackResponse,
      });
    } else {
      console.error("❌ PhonePe callback validation failed: empty response");
      return res.status(400).json({ success: false, message: "Invalid Callback (empty response)" });
    }

  } catch (error: any) {
    console.error("❌ PhonePe webhook validation failed:", error);
    return res.status(400).json({
      success: false,
      message: "Invalid Callback",
      error: error?.message || error,
    });
  }
};