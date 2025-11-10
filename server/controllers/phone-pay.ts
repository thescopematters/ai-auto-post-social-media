import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../config/database";
import { randomUUID } from "crypto";
import { StandardCheckoutPayRequest } from "pg-sdk-node";
import { Request, Response } from "express";
import { Database } from "../types/database.types";
import logger from "../config/logger";
import { phonePayClient } from "../config/phonepe.client";
import dotenv from "dotenv";
import cron from "node-cron";

import { addMonths } from "date-fns";

dotenv.config();

type TransactionInsert = Database["public"]["Tables"]["payment_transactions"]["Insert"];
type PaymentTransaction = Database["public"]["Tables"]["payment_transactions"]["Row"];


// 🔹 Helper to activate any plan after payment success
const activatePlanForUser = async (userId: string, planId: string) => {
  const { data: userPlan } = await supabaseAdmin
    .from("users_plans")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!userPlan) throw new Error("User plan record not found");

  const now = new Date();
  const oneMonthLater = addMonths(now, 1);

  if (userPlan.subs_plan_id !== planId) {
    // Update current plan
    await supabaseAdmin
      .from("users_plans")
      .update({
        subs_plan_id: planId,
        status: "active",
        start_date: now.toISOString(),
        end_date: oneMonthLater.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);

    // Insert plan history
    await supabaseAdmin
      .from("users_plans_history")
      .insert({
        user_plan_id: userPlan.id,
        plan_id: planId,
        status: "active",
        start_date: now.toISOString(),
        end_date: oneMonthLater.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
  }
};

// ------------------- CREATE ORDER -------------------
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userId = req.user.id;
    const { amount, plan: selectedPlan } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: "Invalid amount" });

    if (!selectedPlan)
      return res.status(400).json({ success: false, message: "Plan is required" });

    const { data: planData } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("plans_name", selectedPlan)
      .eq("status", "active")
      .single();

    if (!planData) return res.status(404).json({ success: false, message: "Plan not found" });

    const merchantTransactionId = randomUUID();

    const payload = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantTransactionId)
      .amount(amount * 100)
      .redirectUrl(
        process.env.PHONEPE_REDIRECT_URL ||
        `${process.env.FRONTEND_URL}/subscription?merchantTransactionId=${merchantTransactionId}`
      )
      .build();

    const response = await phonePayClient.pay(payload);

    if (!response.redirectUrl || !response.orderId)
      throw new Error("Failed to get redirect URL or orderId from PhonePe");

    const phonePeOrderId = response.orderId;

    const insertPayload: TransactionInsert = {
      user_id: userId,
      merchant_transaction_id: merchantTransactionId,
      phonepe_order_id: phonePeOrderId,
      amount,
      status: "PENDING",
      plan_id: planData.id,
    };

    const { data: insertedRow, error: dbError } = await supabaseAdmin
      .from("payment_transactions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (dbError) throw new Error("DB Insert Failed: " + dbError.message);

    return res.status(200).json({
      success: true,
      redirectUrl: response.redirectUrl,
      merchantTransactionId,
      phonePeOrderId,
    });
  } catch (err: any) {
    console.error("❌ Payment Order Creation Failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------- GET PAYMENT HISTORY -------------------
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { limit = 20 } = req.query as { limit?: any };
    const parsedLimit =
      Number(limit) > 0 && Number(limit) <= 100 ? Number(limit) : 20;

    const { data, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, merchant_transaction_id, amount, status, created_at, plan_id")
      .eq("user_id", req.user.id)
      .in("status", ["SUCCESS", "FAILED"])
      .order("created_at", { ascending: false })
      .limit(parsedLimit);

    if (error) throw new Error(error.message);

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("getPaymentHistory failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------- CHECK STATUS -------------------
export const checkStatus = async (req: Request, res: Response) => {
  try {
    const { merchantTransactionId } = req.params;
    if (!merchantTransactionId)
      return res.status(400).json({ success: false, message: "Transaction ID required" });

    const { data: transaction, error } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("merchant_transaction_id", merchantTransactionId)
      .single<PaymentTransaction>();

    if (error || !transaction)
      return res.status(404).json({ success: false, message: "Transaction not found" });

    if (transaction.status === "PENDING") {
      const response = await phonePayClient.getOrderStatus(merchantTransactionId);
      const newStatus = response?.state?.toUpperCase?.() || "FAILED";

      let finalStatus = "FAILED";
      if (newStatus === "COMPLETED") finalStatus = "SUCCESS";
      else if (newStatus === "PENDING") finalStatus = "PENDING";

      if (finalStatus !== "PENDING") {
        const { error: updateError } = await supabaseAdmin
          .from("payment_transactions")
          .update({ status: finalStatus })
          .eq("merchant_transaction_id", merchantTransactionId);

        if (updateError) throw new Error(updateError.message);

        transaction.status = finalStatus;

        if (finalStatus === "SUCCESS") {
          await activatePlanForUser(transaction.user_id, transaction.plan_id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      transactionId: transaction.merchant_transaction_id,
      planId: transaction.plan_id,
    });
  } catch (err: any) {
    console.error("Check status failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------- WEBHOOK -------------------
export const webhook = async (req: Request, res: Response) => {
  try {
    const rawBodyString =
      req.body instanceof Buffer
        ? req.body.toString("utf8")
        : JSON.stringify(req.body);

    const authorizationHeader = req.headers["authorization"] as string;
    const USERNAME = process.env.PHONEPE_WEBHOOK_USERNAME!;
    const PASSWORD = process.env.PHONEPE_WEBHOOK_PASSWORD!;
    if (!USERNAME || !PASSWORD) throw new Error("Missing PhonePe webhook credentials");

    const callbackResponse = phonePayClient.validateCallback(
      USERNAME,
      PASSWORD,
      authorizationHeader,
      rawBodyString
    );

    if (!callbackResponse) return res.status(400).json({ success: false, message: "Invalid callback" });

    const payload = callbackResponse.payload;
    const phonePeOrderId = payload.orderId;
    const newStatus = payload.state?.toUpperCase() || "FAILED";

    const { data: txn, error: fetchError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("phonepe_order_id", phonePeOrderId)
      .single();

    if (fetchError || !txn)
      return res.status(404).json({ success: false, message: "Transaction not found" });

    if (txn.status === "PENDING") {
      let finalStatus = "FAILED";
      if (newStatus === "COMPLETED") finalStatus = "SUCCESS";
      else if (newStatus === "PENDING") finalStatus = "PENDING";

      if (finalStatus !== "PENDING") {
        const { error: updateError } = await supabaseAdmin
          .from("payment_transactions")
          .update({ status: finalStatus })
          .eq("phonepe_order_id", phonePeOrderId);

        if (updateError) throw new Error(updateError.message);

        if (finalStatus === "SUCCESS") {
          await activatePlanForUser(txn.user_id, txn.plan_id);
        }
      }
    }

    return res.status(200).json({ success: true, message: "Webhook processed", data: txn });
  } catch (err: any) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ success: false, message: err.message || "Webhook failed" });
  }
};



let isSchedulerRunning = false;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours

export const startScheduler = () => {
  cron.schedule("* * * * *", async () => {
    if (isSchedulerRunning) return;
    isSchedulerRunning = true;

    try {
      await processPendingTransactions();
    } catch (err) {
      console.error("Scheduler error:", err);
    } finally {
      isSchedulerRunning = false;
    }
  });

  console.log("✅ Payment Cron Scheduler Started");
};

export const processPendingTransactions = async () => {
  try {
    const max_recheck = Number(process.env.MAX_RECHECK || 10);
    const delay_ms = Number(process.env.DELAY_MS || 500);
    const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS).toISOString();

    while (true) {
      const { data: pendingTxns, error } = await supabaseAdmin
        .from("payment_transactions")
        .select("*")
        .or(
          `and(status.eq.PENDING,recheck_count.lt.${max_recheck}),` +
          `and(status.eq.PENDING,last_checked_at.lt.${twoHoursAgo})`
        )
        .order("recheck_count", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(5);

      if (error) throw new Error(error.message);
      if (!pendingTxns || pendingTxns.length === 0) break;

      console.log(
        `${new Date().toISOString()} — 🔁 Processing batch of ${pendingTxns.length} transactions`
      );

      for (const txn of pendingTxns) {
        try {
          // Update recheck_count + last_checked_at
          await supabaseAdmin
            .from("payment_transactions")
            .update({
              recheck_count: txn.recheck_count + 1,
              last_checked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", txn.id);

          // Fetch PhonePe status
          const response = await phonePayClient.getOrderStatus(txn.merchant_transaction_id);
          const remoteState = response?.state?.toUpperCase?.() || "PENDING";

          let finalStatus = txn.status;

          // Only change status if PhonePe reports COMPLETED or FAILED
          if (remoteState === "COMPLETED") finalStatus = "SUCCESS";
          else if (remoteState === "FAILED") finalStatus = "FAILED";

          if (finalStatus !== txn.status && finalStatus !== "PENDING") {
            await supabaseAdmin
              .from("payment_transactions")
              .update({
                status: finalStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", txn.id);

            if (finalStatus === "SUCCESS") {
              await activatePlanForUser(txn.user_id, txn.plan_id);
            }

            console.log(
              `${new Date().toISOString()} — ✅ TX ${txn.merchant_transaction_id} updated to ${finalStatus}`
            );
          } else {
            console.log(
              `${new Date().toISOString()} — ⏳ TX ${txn.merchant_transaction_id} still pending → recheck_count=${txn.recheck_count + 1}`
            );
          }

          await sleep(delay_ms);
        } catch (ex) {
          console.error(
            `${new Date().toISOString()} — ❌ Error processing ${txn.merchant_transaction_id}:`,
            ex
          );
        }
      }

      console.log(
        `${new Date().toISOString()} — ✅ Finished processing batch of ${pendingTxns.length} transactions`
      );
    }

    console.log(`${new Date().toISOString()} — ✅ No more pending transactions to process`);
  } catch (err) {
    console.error(
      `${new Date().toISOString()} — ❌ Error in processPendingTransactions:`,
      err
    );
  }
};
