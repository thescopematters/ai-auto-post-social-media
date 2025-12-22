import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../config/database";
import { randomUUID } from "crypto";
import { StandardCheckoutPayRequest } from "pg-sdk-node";
import { Database } from "../types/database.types";
import logger from "../config/logger";
import { phonePayClient } from "../config/phonepe.client";
import dotenv from "dotenv";
import cron from "node-cron";
import { addMonths } from "date-fns";


dotenv.config();

type TransactionInsertBase = Database["public"]["Tables"]["payment_transactions"]["Insert"];
type PaymentTransaction = Database["public"]["Tables"]["payment_transactions"]["Row"];

// 🐛 FIX: Custom type definition to resolve TypeScript error (Code 2353).
type PaymentInsertPayload = TransactionInsertBase & {
  recheck_count: number;
  last_checked_at: string;
};


// 🔹 Helper to activate any plan after payment success
const activatePlanForUser = async (userId: string, planId: string) => {
  const { data: userPlan } = await supabaseAdmin
    .from("users_plans")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!userPlan) throw new Error("User plan record not found");

  const now = new Date();
  let startDate = now;

  // If user has an active paid plan that hasn't expired yet, extend it
  // We check if end_date exists and is in the future
  if (userPlan.end_date && new Date(userPlan.end_date) > now) {
    startDate = new Date(userPlan.end_date);
    logger.info(`Extending subscription for user ${userId} from existing end date: ${userPlan.end_date}`);
  } else {
    logger.info(`Starting new subscription period for user ${userId} from now.`);
  }

  const endDate = addMonths(startDate, 1);

  // Update current plan
  await supabaseAdmin
    .from("users_plans")
    .update({
      subs_plan_id: planId,
      status: "active",
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
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
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
};

// ------------------- CREATE ORDER -------------------
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userId = req.user.id;
    const { amount, plan: selectedPlan } = req.body;
    logger.info(">>>>", req.body)
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

    const insertPayload: PaymentInsertPayload = {
      user_id: userId,
      merchant_transaction_id: merchantTransactionId,
      phonepe_order_id: phonePeOrderId,
      amount,
      status: "PENDING", // Status is PENDING upon creation
      recheck_count: 0,
      last_checked_at: new Date().toISOString(),
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
    logger.error("❌ Payment Order Creation Failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------- GET PAYMENT HISTORY -------------------
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { limit = 20 } = req.query;
    const parsedLimit =
      Number(limit) > 0 && Number(limit) <= 100 ? Number(limit) : 20;

    // 1️⃣ Get all transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .select("id, merchant_transaction_id, amount, status, created_at, plan_id")
      .eq("user_id", req.user.id)
      .in("status", ["SUCCESS", "FAILED"])
      .order("created_at", { ascending: false })
      .limit(parsedLimit);

    if (txError) throw new Error(txError.message);

    // 2️⃣ Get the user's plan end_date
    const { data: plan, error: planError } = await supabaseAdmin
      .from("users_plans")
      .select("end_date")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (planError) throw new Error(planError.message);

    // 3️⃣ Merge end_date into each transaction
    const finalData = transactions.map((tx) => {
      // Calculate end date based on transaction creation date (assuming 1 month duration)
      // This ensures historical transactions show their correct period
      const startDate = new Date(tx.created_at);
      const endDate = addMonths(startDate, 1);

      return {
        ...tx,
        end_date: tx.status === "SUCCESS" ? endDate.toISOString() : null,
      };
    });

    return res.status(200).json({ success: true, data: finalData });
  } catch (err: any) {
    logger.error("getPaymentHistory failed:", err);
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
      // 1. Check status with PhonePe
      const response = await phonePayClient.getOrderStatus(merchantTransactionId);
      const newStatus = response?.state?.toUpperCase?.() || "FAILED";

      let finalStatus = "PENDING"; // Default to pending if not completed or failed
      if (newStatus === "COMPLETED") finalStatus = "SUCCESS";
      else if (newStatus === "FAILED") finalStatus = "FAILED";

      // 2. Update DB only if a final status is confirmed
      if (finalStatus !== "PENDING") {
        const { error: updateError } = await supabaseAdmin
          .from("payment_transactions")
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq("merchant_transaction_id", merchantTransactionId);

        if (updateError) throw new Error(updateError.message);

        // 3. Update local copy and fulfill
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
    logger.error("Check status failed:", err);
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

    if (!USERNAME || !PASSWORD)
      throw new Error("Missing PhonePe webhook credentials");

    let callbackResponse;

    // ➤ FIRST: skip validation in local dev
    if (process.env.NODE_ENV === "development") {
      logger.warn("⚠️ Skipping PhonePe signature check in development mode");
      callbackResponse = { payload: JSON.parse(rawBodyString) };
    } else {
      // ➤ ONLY in production: validate callback signature
      callbackResponse = phonePayClient.validateCallback(
        USERNAME,
        PASSWORD,
        authorizationHeader,
        rawBodyString
      );
    }

    if (!callbackResponse)
      return res.status(400).json({ success: false, message: "Invalid callback" });

    const payload = callbackResponse.payload;
    const phonePeOrderId = payload.orderId;
    const newStatus = payload.state?.toUpperCase() || "FAILED";
    logger.info(">>> Extracted phonePeOrderId =", phonePeOrderId);

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
      else if (newStatus === "PENDING") finalStatus = "PENDING"; // Keep PENDING if webhook says PENDING

      if (finalStatus !== "PENDING") {
        const { error: updateError } = await supabaseAdmin
          .from("payment_transactions")
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq("phonepe_order_id", phonePeOrderId);

        if (updateError) throw new Error(updateError.message);

        if (finalStatus === "SUCCESS") {
          await activatePlanForUser(txn.user_id, txn.plan_id);
        }
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Webhook processed", data: txn });
  } catch (err: any) {
    logger.error("❌ Webhook error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Webhook failed" });
  }
};


// ------------------- SCHEDULER LOGIC -------------------

let isSchedulerRunning = false;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours


// 🔄 UPDATED: startScheduler now calls the new expiration processor.
export const startScheduler = () => {
  // CRON job scheduled to run once every hour (at the 0 minute mark)
  cron.schedule("0 * * * *", async () => {
    if (isSchedulerRunning) return;
    isSchedulerRunning = true;

    try {
      // 1. Process pending transactions
      await processPendingTransactions();

      // 2. Process expired subscriptions
      await processExpiredSubscriptions();

    } catch (err) {
      logger.error("Scheduler error:", err);
    } finally {
      isSchedulerRunning = false;
    }
  });

  logger.info("✅ Payment Cron Scheduler Started (Hourly)");
};

/**
 * Checks for and resolves transactions stuck in PENDING status.
 */
export const processPendingTransactions = async () => {
  try {
    const max_recheck = Number(process.env.MAX_RECHECK || 10);
    const delay_ms = Number(process.env.DELAY_MS || 500);
    const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS).toISOString();

    while (true) {
      // 1. Fetch a batch of pending transactions
      const { data: pendingTxns, error } = await supabaseAdmin
        .from("payment_transactions")
        .select("*")
        .or(
          // Check: PENDING AND (recheck count is low OR last checked is old)
          `and(status.eq.PENDING,recheck_count.lt.${max_recheck}),` +
          `and(status.eq.PENDING,last_checked_at.lt.${twoHoursAgo})`
        )
        .order("recheck_count", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(5);

      if (error) throw new Error(error.message);
      if (!pendingTxns || pendingTxns.length === 0) break;

      logger.info(
        `${new Date().toISOString()} — 🔁 Processing batch of ${pendingTxns.length} transactions`
      );

      for (const txn of pendingTxns) {
        try {
          // 2. FETCH STATUS from PhonePe first
          const response = await phonePayClient.getOrderStatus(txn.merchant_transaction_id);
          const remoteState = response?.state?.toUpperCase?.() || "PENDING";

          let finalStatus = txn.status;
          let planActivated = false;

          // 3. DETERMINE FINAL STATUS based on PhonePe check
          if (remoteState === "COMPLETED") finalStatus = "SUCCESS";
          else if (remoteState === "FAILED") finalStatus = "FAILED";

          // 4. Prepare the single update payload
          const updatePayload: Record<string, any> = {
            recheck_count: txn.recheck_count + 1,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const isStatusChanging = finalStatus !== txn.status && finalStatus !== "PENDING";

          // 5. Only include 'status' if it changed from PENDING to SUCCESS/FAILED
          if (isStatusChanging) {
            updatePayload.status = finalStatus;
          }

          // 6. Perform a SINGLE ATOMIC DATABASE UPDATE
          await supabaseAdmin
            .from("payment_transactions")
            .update(updatePayload)
            .eq("id", txn.id);

          // 7. Execute side effects (like plan activation) only if status changed to SUCCESS
          if (finalStatus === "SUCCESS" && txn.status !== "SUCCESS") {
            await activatePlanForUser(txn.user_id, txn.plan_id);
            planActivated = true;
          }

          // 8. Logging
          if (isStatusChanging) {
            logger.info(
              `${new Date().toISOString()} — ✅ TX ${txn.merchant_transaction_id} updated to ${finalStatus}${planActivated ? ' (Plan Activated)' : ''}`
            );
          } else {
            logger.info(
              `${new Date().toISOString()} — ⏳ TX ${txn.merchant_transaction_id} still pending → recheck_count=${txn.recheck_count + 1}`
            );
          }

          await sleep(delay_ms);
        } catch (ex) {
          logger.error(
            `${new Date().toISOString()} — ❌ Error processing ${txn.merchant_transaction_id}:`,
            ex
          );
        }
      }

      logger.info(
        `${new Date().toISOString()} — ✅ Finished processing batch of ${pendingTxns.length} transactions`
      );
    }

    logger.info(`${new Date().toISOString()} — ✅ No more pending transactions to process`);
  } catch (err) {
    logger.error(
      `${new Date().toISOString()} — ❌ Error in processPendingTransactions:`,
      err
    );
  }
};

export const processExpiredSubscriptions = async () => {
  try {
    const now = new Date().toISOString();

    // 1. Fetch the ID of the 'Free' plan (case-insensitive partial match)
    const { data: freePlan, error: freePlanError } = await supabaseAdmin
      .from("plans")
      .select("id")
      .ilike("plans_name", "%free%") // Matches "Free", "Free Plan", etc.
      .single();


    if (freePlanError || !freePlan) {
      logger.error("Free plan ID not found in the 'plans' table.");
      // It's critical to ensure a Free plan exists in the DB
      return;
    }
    const freePlanId = freePlan.id;
    console.log(">>>>>>>?id", freePlan.id)

    // 2. Fetch all active subscriptions that have expired
    const { data: expiredPlans, error: expiredError } = await supabaseAdmin
      .from("users_plans")
      .select("*")
      .lt("end_date", now)
      .neq("subs_plan_id", freePlanId); // Don't downgrade if already free

    if (expiredError) {
      logger.error("Error fetching expired plans:", expiredError);
      return;
    }

    console.log(">>>>>>?", expiredPlans)
    if (!expiredPlans || expiredPlans.length === 0) {
      // No expired plans to process
      return;
    }

    logger.info(`Found ${expiredPlans.length} expired plans. Processing...`);

    // 3. Downgrade each user to Free
    for (const plan of expiredPlans) {
      try {
        // Update users_plans table
        await supabaseAdmin
          .from("users_plans")
          .update({
            subs_plan_id: freePlanId,
            status: "active", // or 'downgraded' if you prefer
            updated_at: now,
          })
          .eq("user_id", plan.user_id);

        // Insert into history
        await supabaseAdmin
          .from("users_plans_history")
          .insert({
            user_plan_id: plan.id,
            plan_id: freePlanId,
            status: "expired/reset",
            start_date: now,
            end_date: now,
            created_at: now,
            updated_at: now,
          });

        logger.info(`⭐ User ${plan.user_id} plan reset from ${plan.subs_plan_id} to Free.`);
      } catch (planUpdateError) {
        logger.error(`Failed to reset plan for user ${plan.user_id}:`, planUpdateError);
      }
    }

  } catch (err) {
    logger.error("Fatal error in processExpiredSubscriptions:", err);
  }
};
