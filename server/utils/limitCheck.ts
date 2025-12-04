// COMPLETE FILE - Replace your entire file with this updated version

import supabaseAdmin from "../config/database";

interface UsageLimits {
  canGenerate: boolean;
  message?: string;
  currentUsage: number;
  limit: number;
  planType: string;
  remaining: number;
}

interface WeeklyPostLimits {
  canPost: boolean;
  message?: string;
  postsThisWeek: number;
  limit: number;
  planType: string;
  nextResetDate: string;
}

interface DocumentLimits {
  canUpload: boolean;
  message?: string;
  currentCount: number;
  limit: number;
  planType: string;
}

interface DailyPostLimits {
  canPostToday: boolean;
  message?: string;
  currentDaily: number;
  dailyLimit: number;
  planType: string;
}

interface IncrementOptions {
  type: "ai" | "daily_post" | "weekly_post" | "published_post" | "document";
  userId: string;
  platform?: string;
  scheduledTimeISO?: string;
}

interface DecrementOptions {
  type: "document";
  userId: string;
}

export const getUserPlanLimits = async (userId: string) => {
  console.log("inside getUserPlanLimits");

  const FREE_LIMITS = {
    plan_type: "free",
    ai_daily_limit: 10,
    document_limit: 2,
    daily_post_limit: 1,
    weekly_post_limit: 2,
  };

  const PRO_LIMITS = {
    plan_type: "pro",
    ai_daily_limit: 0,
    document_limit: 0,
    daily_post_limit: 0,
    weekly_post_limit: 100,
  };

  try {
    const { data: userPlan, error: userPlanError } = await supabaseAdmin
      .from("users_plans")
      .select("subs_plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (userPlanError || !userPlan) {
      console.warn("⚠️ No active plan found, defaulting to free");
      return FREE_LIMITS;
    }
    console.log(">>>>>userplan", userPlan)

    const { data: planData, error: planError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", userPlan.subs_plan_id)
      .maybeSingle();

    console.log("📊 Full plan data:", JSON.stringify(planData, null, 2));

    if (!planData) {
      console.error(`❌ Plan ID ${userPlan.subs_plan_id} not found in plans table`);
      if (planError) {
        console.error(`❌ Error details:`, planError);
      }
      return FREE_LIMITS;
    }

    const limitData = planData.limit || planData.limits || planData.plan_limits;

    if (!limitData) {
      console.error("❌ Plan exists but no limit field found. Available fields:", Object.keys(planData));
      return FREE_LIMITS;
    }

    const planType = limitData.plan_type.toLowerCase();

    if (planType === "pro") {
      console.log("✅ User has PRO plan!");
      return PRO_LIMITS;
    }

    console.log(`✅ User has ${planType} plan, defaulting to FREE limits for non-PRO.`);
    return FREE_LIMITS;

  } catch (error) {
    console.error("❌ Error getting user plan:", error);
    return FREE_LIMITS;
  }
};

// Helper function to get next reset date (7 days from week start)
const getNextResetDate = (weekStartDate: string): Date => {
  const startDate = new Date(weekStartDate);
  const nextReset = new Date(startDate);
  nextReset.setDate(startDate.getDate() + 7); // Add 7 days
  nextReset.setHours(0, 0, 0, 0);
  return nextReset;
};

const getTodayDate = (): string => new Date().toISOString().split("T")[0];

const getOrCreateUsageRecord = async (userId: string) => {
  try {
    const { data: existingRecord, error } = await supabaseAdmin
      .from("user_usage_limits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && existingRecord) {
      let record = existingRecord;
      record = await checkAndResetWeeklyCounts(record);
      record = await checkAndResetDailyCounts(record);
      return record;
    }

    // For new users, don't set week_start_date yet
    // It will be set when they make their first post
    const initialUsage = {
      total_ai_generations: 0,
      ai_daily_count: 0,
      ai_last_reset_date: getTodayDate(),
      daily_post_count: 0,
      post_last_reset_date: getTodayDate(),
      weekly_posts_count: 0,
      week_start_date: null, // Changed: null until first post
      next_reset_date: null, // Changed: null until first post
      total_documents: 0,
      last_post_time: null
    };

    const { data: newRecord, error: createError } = await supabaseAdmin
      .from("user_usage_limits")
      .insert({ user_id: userId, usage_data: initialUsage })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create usage record: ${createError.message}`);
    }

    return newRecord;
  } catch (error) {
    console.error("❌ Error in getOrCreateUsageRecord:", error);
    throw error;
  }
};

const checkAndResetWeeklyCounts = async (record: any) => {
  try {
    const usageData = record.usage_data || {};

    // If no week_start_date, user hasn't posted yet - no reset needed
    if (!usageData.week_start_date) {
      return record;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(usageData.week_start_date);
    weekStart.setHours(0, 0, 0, 0);

    const nextReset = new Date(usageData.next_reset_date);
    nextReset.setHours(0, 0, 0, 0);

    // Check if we've passed the reset date (7 days from week start)
    if (today >= nextReset) {
      console.log("🔄 Resetting weekly counts - 7 days passed since week start");

      // Calculate new week start (today) and next reset (today + 7 days)
      const newWeekStart = getTodayDate();
      const newNextReset = getNextResetDate(newWeekStart);

      const updatedUsageData = {
        ...usageData,
        weekly_posts_count: 0,
        week_start_date: newWeekStart,
        next_reset_date: newNextReset.toISOString()
      };

      const { data: updatedRecord, error } = await supabaseAdmin
        .from("user_usage_limits")
        .update({
          usage_data: updatedUsageData,
          updated_at: new Date().toISOString()
        })
        .eq("id", record.id)
        .select()
        .single();

      if (!error && updatedRecord) return updatedRecord;
      return { ...record, usage_data: updatedUsageData };
    }

    return record;
  } catch (error) {
    console.error("❌ Error in checkAndResetWeeklyCounts:", error);
    return record;
  }
};

export const incrementUsage = async (options: IncrementOptions) => {
  const { type, userId, platform, scheduledTimeISO } = options;

  try {
    const record = await getOrCreateUsageRecord(userId);
    const usage = record.usage_data || {};
    const updatedUsage = { ...usage };

    console.log(`📊 Incrementing ${type} for user ${userId}`, {
      currentDaily: usage.daily_post_count,
      currentWeekly: usage.weekly_posts_count
    });

    switch (type) {
      case "ai":
        updatedUsage.ai_daily_count = (usage.ai_daily_count || 0) + 1;
        updatedUsage.total_ai_generations = (usage.total_ai_generations || 0) + 1;
        updatedUsage.ai_last_reset_date = usage.ai_last_reset_date || getTodayDate();
        break;

      case "daily_post":
        updatedUsage.daily_post_count = (usage.daily_post_count || 0) + 1;
        updatedUsage.last_post_time = new Date().toISOString();
        updatedUsage.post_last_reset_date = usage.post_last_reset_date || getTodayDate();
        break;

      case "weekly_post":
      case "published_post":
        // If this is the first post ever, set week_start_date to today
        if (!usage.week_start_date) {
          const today = getTodayDate();
          updatedUsage.week_start_date = today;
          updatedUsage.next_reset_date = getNextResetDate(today).toISOString();
          console.log(`🎯 First post! Week starts: ${today}, Resets: ${updatedUsage.next_reset_date}`);
        }

        updatedUsage.weekly_posts_count = (usage.weekly_posts_count || 0) + 1;
        updatedUsage.daily_post_count = (usage.daily_post_count || 0) + 1;
        updatedUsage.last_post_time = scheduledTimeISO || new Date().toISOString();
        updatedUsage.post_last_reset_date = usage.post_last_reset_date || getTodayDate();

        console.log(`✅ Post counted: daily=${updatedUsage.daily_post_count}, weekly=${updatedUsage.weekly_posts_count}`);
        console.log(`📅 Week resets on: ${updatedUsage.next_reset_date}`);
        break;

      case "document":
        updatedUsage.total_documents = (usage.total_documents || 0) + 1;
        break;
    }

    await supabaseAdmin
      .from("user_usage_limits")
      .update({ usage_data: updatedUsage, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (platform && type !== "document") {
      const { data: platformRecord } = await supabaseAdmin
        .from("platform_usage")
        .select("platform_data")
        .eq("user_id", userId)
        .eq("platform", platform)
        .single();

      const platformData = platformRecord?.platform_data || {
        ai_generations_count: 0,
        published_posts_count: 0,
        scheduled_posts_count: 0,
        last_activity: new Date().toISOString()
      };

      switch (type) {
        case "ai":
          platformData.ai_generations_count = (platformData.ai_generations_count || 0) + 1;
          break;
        case "weekly_post":
          platformData.scheduled_posts_count = (platformData.scheduled_posts_count || 0) + 1;
          break;
        case "published_post":
        case "daily_post":
          platformData.published_posts_count = (platformData.published_posts_count || 0) + 1;
          break;
      }

      platformData.last_activity = new Date().toISOString();

      if (platformRecord) {
        await supabaseAdmin
          .from("platform_usage")
          .update({ platform_data: platformData, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("platform", platform);
      } else {
        await supabaseAdmin
          .from("platform_usage")
          .insert({ user_id: userId, platform, platform_data: platformData });
      }
    }
  } catch (error) {
    console.error(`❌ Error incrementing ${type} count:`, error);
  }
};

export const decrementUsage = async (options: DecrementOptions) => {
  const { type, userId } = options;

  if (type !== "document") {
    console.warn("Attempted to decrement unsupported type:", type);
    return;
  }

  try {
    const record = await getOrCreateUsageRecord(userId);
    const usage = record.usage_data || {};
    const updatedUsage = { ...usage };

    if (usage.total_documents > 0) {
      updatedUsage.total_documents = (usage.total_documents || 0) - 1;
    } else {
      console.warn(`User ${userId} attempted to decrement document count below zero.`);
    }

    await supabaseAdmin
      .from("user_usage_limits")
      .update({ usage_data: updatedUsage, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

  } catch (error) {
    console.error(`❌ Error decrementing ${type} count:`, error);
  }
};

const checkAndResetDailyCounts = async (record: any) => {
  try {
    const today = getTodayDate();
    const usageData = record.usage_data || {};
    let shouldUpdate = false;
    const updatedUsageData = { ...usageData };

    if (usageData.ai_last_reset_date !== today) {
      console.log("🔄 Resetting AI daily count - new day detected");
      updatedUsageData.ai_daily_count = 0;
      updatedUsageData.ai_last_reset_date = today;
      shouldUpdate = true;
    }

    if (usageData.post_last_reset_date !== today) {
      console.log("🔄 Resetting daily post count - new day detected");
      updatedUsageData.daily_post_count = 0;
      updatedUsageData.post_last_reset_date = today;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      const { data: updatedRecord, error } = await supabaseAdmin
        .from("user_usage_limits")
        .update({ usage_data: updatedUsageData, updated_at: new Date().toISOString() })
        .eq("id", record.id)
        .select()
        .single();

      if (!error && updatedRecord) return updatedRecord;
      return { ...record, usage_data: updatedUsageData };
    }

    return record;
  } catch (error) {
    console.error("❌ Error in checkAndResetDailyCounts:", error);
    return record;
  }
};

export const checkAIGenerationLimit = async (
  userId: string,
  planLimits?: any
): Promise<UsageLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const limits = planLimits || await getUserPlanLimits(userId);

    const currentUsage = usageRecord.usage_data.ai_daily_count || 0;
    const limit = limits.ai_daily_limit;
    const remaining = limit === 0 ? Infinity : Math.max(0, limit - currentUsage);

    return {
      canGenerate: limit === 0 ? true : currentUsage < limit,
      message: limit !== 0 && currentUsage >= limit
        ? `AI generation daily limit reached (${limit}). Reset at 00:00.`
        : undefined,
      currentUsage,
      limit,
      planType: limits.plan_type,
      remaining: limit === 0 ? -1 : remaining
    };
  } catch (error) {
    console.error("❌ Error in AI generation limit check:", error);
    return {
      canGenerate: false,
      message: "Error checking limits",
      currentUsage: 0,
      limit: 10,
      planType: "free",
      remaining: 10
    };
  }
};

export const checkDocumentUploadLimit = async (
  userId: string,
  planLimits?: any
): Promise<DocumentLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const limits = planLimits || await getUserPlanLimits(userId);

    const currentCount = usageRecord.usage_data.total_documents || 0;
    const limit = limits.document_limit;

    return {
      canUpload: limit === 0 ? true : currentCount < limit,
      message: limit !== 0 && currentCount >= limit
        ? `Document limit reached (${limit}). Upgrade to Pro for unlimited.`
        : undefined,
      currentCount,
      limit,
      planType: limits.plan_type
    };
  } catch (error) {
    console.error("❌ Error in document limit check:", error);
    return {
      canUpload: false,
      message: "Error checking limits",
      currentCount: 0,
      limit: 2,
      planType: "free"
    };
  }
};

export const checkDailyPostLimit = async (
  userId: string,
  planLimits?: any
): Promise<DailyPostLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const limits = planLimits || await getUserPlanLimits(userId);

    const currentDaily = usageRecord.usage_data.daily_post_count || 0;
    const dailyLimit = limits.daily_post_limit;

    // 🔍 DEBUG LOG
    console.log('🔍 Daily Limit Check:', {
      userId,
      currentDaily,
      dailyLimit,
      canPostToday: dailyLimit === 0 ? true : currentDaily < dailyLimit,
      lastResetDate: usageRecord.usage_data.post_last_reset_date,
      today: getTodayDate(),
      planType: limits.plan_type
    });

    return {
      canPostToday: dailyLimit === 0 ? true : currentDaily < dailyLimit,
      message: dailyLimit !== 0 && currentDaily >= dailyLimit
        ? `Daily post limit reached (${dailyLimit}). Reset at 00:00.`
        : undefined,
      currentDaily,
      dailyLimit,
      planType: limits.plan_type
    };
  } catch (error) {
    console.error("❌ Error checking daily post limit:", error);
    return {
      canPostToday: false,
      message: "Error checking limits",
      currentDaily: 0,
      dailyLimit: 1,
      planType: "free"
    };
  }
};

export const checkWeeklyPostLimit = async (
  userId: string,
  planLimits?: any
): Promise<WeeklyPostLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const limits = planLimits || await getUserPlanLimits(userId);

    const currentUsage = usageRecord.usage_data.weekly_posts_count || 0;
    const limit = limits.weekly_post_limit;
    const nextResetDate = usageRecord.usage_data.next_reset_date || new Date().toISOString();

    // 🔍 DEBUG LOG
    console.log('🔍 Weekly Limit Check:', {
      userId,
      currentUsage,
      limit,
      canPost: limit === 0 || currentUsage < limit,
      planType: limits.plan_type,
      nextResetDate,
      weekStartDate: usageRecord.usage_data.week_start_date
    });

    return {
      canPost: limit === 0 || currentUsage < limit,
      message: currentUsage >= limit
        ? `Weekly post limit reached (${limit}). Next reset: ${(() => {
          const d = new Date(nextResetDate);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const formattedDate = `${d.getDate()}/${months[d.getMonth()]}/${d.getFullYear()}`;
          console.log('🔍 FORMATTED DATE:', formattedDate);
          return formattedDate;
        })()}`
        : undefined,
      postsThisWeek: currentUsage,
      limit,
      planType: limits.plan_type,
      nextResetDate: nextResetDate
    };
  } catch (error) {
    console.error("❌ Error in weekly post limit check:", error);
    return {
      canPost: false,
      message: "Error checking limits",
      postsThisWeek: 0,
      limit: 2,
      planType: "free",
      nextResetDate: new Date().toISOString()
    };
  }
};