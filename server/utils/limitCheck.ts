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

const getUserPlanLimits = async (userId: string) => {
  try {
    const { data: userPlan, error } = await supabaseAdmin
      .from("users_plans")
      .select("*, plans:subs_plan_id(limit)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (error || !userPlan) {
      // Default free plan limits
      return {
        plan_type: "free",
        ai_limit: 10,
        document_limit: 2,
        weekly_post_limit: 2
      };
    }

    const planData = userPlan.plans?.limit || {};
    const planType = planData.plan_type || "free";
    
    return {
      plan_type: planType,
      ai_limit: planType === "pro" ? 100 : 10,
      document_limit: planType === "pro" ? 20 : 2,
      weekly_post_limit: planType === "pro" ? 0 : 2 // 0 = unlimited
    };
  } catch (error) {
    console.error("❌ Error getting user plan:", error);
    return {
      plan_type: "free",
      ai_limit: 10,
      document_limit: 2,
      weekly_post_limit: 2
    };
  }
};

const getOrCreateUsageRecord = async (userId: string) => {
  try {
    // Try to get existing record
    const { data: existingRecord, error } = await supabaseAdmin
      .from("user_usage_limits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && existingRecord) {
      return await checkAndResetWeeklyCounts(existingRecord);
    }

    // Create new record
    const weekStart = getWeekStartDate();
    const nextResetDate = getNextMonday();

    const { data: newRecord, error: createError } = await supabaseAdmin
      .from("user_usage_limits")
      .insert({
        user_id: userId,
        usage_data: {
          total_ai_generations: 0,
          total_documents: 0,
          weekly_posts_count: 0,
          week_start_date: weekStart,
          next_reset_date: nextResetDate.toISOString()
        }
      })
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
    const currentWeekStart = getWeekStartDate();
    const usageData = record.usage_data;
    
    // If week has changed, reset weekly posts count
    if (usageData.week_start_date !== currentWeekStart) {
      const nextResetDate = getNextMonday();
      
      const updatedUsageData = {
        ...usageData,
        weekly_posts_count: 0,
        week_start_date: currentWeekStart,
        next_reset_date: nextResetDate.toISOString()
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

      if (!error && updatedRecord) {
        return updatedRecord;
      }
    }

    return record;
  } catch (error) {
    console.error("❌ Error in checkAndResetWeeklyCounts:", error);
    return record;
  }
};

export const checkAIGenerationLimit = async (userId: string): Promise<UsageLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const planLimits = await getUserPlanLimits(userId);
    
    const currentUsage = usageRecord.usage_data.total_ai_generations || 0;
    const limit = planLimits.ai_limit;
    const remaining = Math.max(0, limit - currentUsage);

    return {
      canGenerate: currentUsage < limit,
      message: currentUsage >= limit ? 
        `AI generation limit reached (${limit}). ${planLimits.plan_type === "free" ? "Upgrade to Pro for 100 generations." : ""}` 
        : undefined,
      currentUsage,
      limit,
      planType: planLimits.plan_type,
      remaining,
    };
  } catch (error) {
    console.error("❌ Error in AI generation limit check:", error);
    return {
      canGenerate: false,
      message: "Error checking limits",
      currentUsage: 0,
      limit: 10,
      planType: "free",
      remaining: 10,
    };
  }
};

export const checkWeeklyPostLimit = async (userId: string): Promise<WeeklyPostLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const planLimits = await getUserPlanLimits(userId);
    
    // Pro users have unlimited posts
    if (planLimits.weekly_post_limit === 0) {
      return {
        canPost: true,
        postsThisWeek: usageRecord.usage_data.weekly_posts_count || 0,
        limit: 0,
        planType: planLimits.plan_type,
        nextResetDate: usageRecord.usage_data.next_reset_date,
      };
    }

    const currentUsage = usageRecord.usage_data.weekly_posts_count || 0;
    const limit = planLimits.weekly_post_limit;

    return {
      canPost: currentUsage < limit,
      message: currentUsage >= limit ? 
        `Weekly post limit reached (${limit}). Next reset: ${new Date(usageRecord.usage_data.next_reset_date).toLocaleDateString()}` 
        : undefined,
      postsThisWeek: currentUsage,
      limit,
      planType: planLimits.plan_type,
      nextResetDate: usageRecord.usage_data.next_reset_date,
    };
  } catch (error) {
    console.error("❌ Error in weekly post limit check:", error);
    return {
      canPost: false,
      message: "Error checking limits",
      postsThisWeek: 0,
      limit: 2,
      planType: "free",
      nextResetDate: new Date().toISOString(),
    };
  }
};

export const checkDocumentUploadLimit = async (userId: string): Promise<DocumentLimits> => {
  try {
    const usageRecord = await getOrCreateUsageRecord(userId);
    const planLimits = await getUserPlanLimits(userId);
    
    const currentCount = usageRecord.usage_data.total_documents || 0;
    const limit = planLimits.document_limit;

    return {
      canUpload: currentCount < limit,
      message: currentCount >= limit ? 
        `Document limit reached (${limit}). ${planLimits.plan_type === "free" ? "Upgrade to Pro for 20 documents." : ""}` 
        : undefined,
      currentCount,
      limit,
      planType: planLimits.plan_type,
    };
  } catch (error) {
    console.error("❌ Error in document limit check:", error);
    return {
      canUpload: false,
      message: "Error checking limits",
      currentCount: 0,
      limit: 2,
      planType: "free",
    };
  }
};

export const incrementAIGenerationCount = async (userId: string, platform: string) => {
  try {
    // Update global count
    const { data: globalRecord } = await supabaseAdmin
      .from("user_usage_limits")
      .select("usage_data")
      .eq("user_id", userId)
      .single();

    const newGlobalCount = (globalRecord?.usage_data?.total_ai_generations || 0) + 1;

    await supabaseAdmin
      .from("user_usage_limits")
      .update({
        usage_data: {
          ...globalRecord?.usage_data,
          total_ai_generations: newGlobalCount
        },
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    // Update platform count
    const { data: platformRecord } = await supabaseAdmin
      .from("platform_usage")
      .select("platform_data")
      .eq("user_id", userId)
      .eq("platform", platform)
      .single();

    if (platformRecord) {
      const newPlatformCount = (platformRecord.platform_data?.ai_generations_count || 0) + 1;
      
      await supabaseAdmin
        .from("platform_usage")
        .update({
          platform_data: {
            ...platformRecord.platform_data,
            ai_generations_count: newPlatformCount,
            last_activity: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("platform", platform);
    } else {
      await supabaseAdmin
        .from("platform_usage")
        .insert({
          user_id: userId,
          platform: platform,
          platform_data: {
            ai_generations_count: 1,
            published_posts_count: 0,
            scheduled_posts_count: 0,
            last_activity: new Date().toISOString()
          }
        });
    }
  } catch (error) {
    console.error("❌ Error incrementing AI generation count:", error);
  }
};

export const incrementWeeklyPostCount = async (userId: string, platform: string) => {
  try {
    // Update global count
    const { data: globalRecord } = await supabaseAdmin
      .from("user_usage_limits")
      .select("usage_data")
      .eq("user_id", userId)
      .single();

    const newWeeklyCount = (globalRecord?.usage_data?.weekly_posts_count || 0) + 1;

    await supabaseAdmin
      .from("user_usage_limits")
      .update({
        usage_data: {
          ...globalRecord?.usage_data,
          weekly_posts_count: newWeeklyCount
        },
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    // Update platform count
    const { data: platformRecord } = await supabaseAdmin
      .from("platform_usage")
      .select("platform_data")
      .eq("user_id", userId)
      .eq("platform", platform)
      .single();

    if (platformRecord) {
      const newScheduledCount = (platformRecord.platform_data?.scheduled_posts_count || 0) + 1;
      
      await supabaseAdmin
        .from("platform_usage")
        .update({
          platform_data: {
            ...platformRecord.platform_data,
            scheduled_posts_count: newScheduledCount,
            last_activity: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("platform", platform);
    } else {
      await supabaseAdmin
        .from("platform_usage")
        .insert({
          user_id: userId,
          platform: platform,
          platform_data: {
            ai_generations_count: 0,
            published_posts_count: 0,
            scheduled_posts_count: 1,
            last_activity: new Date().toISOString()
          }
        });
    }
  } catch (error) {
    console.error("❌ Error incrementing weekly post count:", error);
  }
};

export const incrementDocumentUploadCount = async (userId: string) => {
  try {
    const { data: globalRecord } = await supabaseAdmin
      .from("user_usage_limits")
      .select("usage_data")
      .eq("user_id", userId)
      .single();

    const newDocumentCount = (globalRecord?.usage_data?.total_documents || 0) + 1;

    await supabaseAdmin
      .from("user_usage_limits")
      .update({
        usage_data: {
          ...globalRecord?.usage_data,
          total_documents: newDocumentCount
        },
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);
  } catch (error) {
    console.error("❌ Error incrementing document upload count:", error);
  }
};

export const incrementPublishedPostCount = async (userId: string, platform: string) => {
  try {
    // Update platform count for published posts
    const { data: platformRecord } = await supabaseAdmin
      .from("platform_usage")
      .select("platform_data")
      .eq("user_id", userId)
      .eq("platform", platform)
      .single();

    if (platformRecord) {
      const newPublishedCount = (platformRecord.platform_data?.published_posts_count || 0) + 1;
      
      await supabaseAdmin
        .from("platform_usage")
        .update({
          platform_data: {
            ...platformRecord.platform_data,
            published_posts_count: newPublishedCount,
            last_activity: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("platform", platform);
    } else {
      await supabaseAdmin
        .from("platform_usage")
        .insert({
          user_id: userId,
          platform: platform,
          platform_data: {
            ai_generations_count: 0,
            published_posts_count: 1,
            scheduled_posts_count: 0,
            last_activity: new Date().toISOString()
          }
        });
    }
  } catch (error) {
    console.error("❌ Error incrementing published post count:", error);
  }
};

const getWeekStartDate = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
};

const getNextMonday = (): Date => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
};