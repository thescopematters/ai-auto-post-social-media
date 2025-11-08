import supabaseAdmin from "../config/database";

interface LimitCheckResponse {
  canGenerate: boolean;
  message?: string;
  currentUsage?: number;
  limit?: number;
  planType?: string;
  remainingAIGenerations?: number;
  totalAIGenerations?: number;
}

export const checkDocumentUploadLimit = async (
  workspaceId: string,
  userId: string
): Promise<{
  canUpload: boolean;
  message?: string;
  currentCount: number;
  limit: number;
  planType: string;
}> => {
  try {
    // Get user plan
    const { data: userPlan } = await supabaseAdmin
      .from("users_plans")
      .select("*, plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const planType = userPlan?.plans?.limit?.plan_type || "free";
    const limit =
      planType === "pro"
        ? parseInt(process.env.PAID_USER_DOCUMENT_LIMIT || "20")
        : parseInt(process.env.FREE_USER_DOCUMENT_LIMIT || "2");

    // Count existing documents for this workspace
    const { data: documents, error } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("❌ Error fetching documents:", error);
      return {
        canUpload: false,
        message: "Error checking document limit",
        currentCount: 0,
        limit,
        planType,
      };
    }

    const currentCount = documents?.length || 0;

    if (currentCount >= limit) {
      return {
        canUpload: false,
        message: `Document limit reached (${limit}). ${
          planType === "free" ? "Upgrade to Pro for 20 documents." : ""
        }`,
        currentCount,
        limit,
        planType,
      };
    }

    return {
      canUpload: true,
      currentCount,
      limit,
      planType,
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

export const checkAIGenerationLimit = async (
  workspaceId: string,
  userId: string
): Promise<{
  canGenerate: boolean;
  message?: string;
  currentUsage: number;
  limit: number;
  planType: string;
  remaining: number;
}> => {
  try {
    // Get user plan
    const { data: userPlan } = await supabaseAdmin
      .from("users_plans")
      .select("*, plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const planType = userPlan?.plans?.limit?.plan_type || "free";
    const limit =
      planType === "pro"
        ? parseInt(process.env.PAID_USER_AI_GENERATION_LIMIT || "100")
        : parseInt(process.env.FREE_USER_AI_GENERATION_LIMIT || "10");

    const { data: posts, error } = await supabaseAdmin
      .from("generated_posts")
      .select("document_id, generated_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Error fetching AI generations:", error);
      return {
        canGenerate: false,
        message: "Error checking AI generation limit",
        currentUsage: 0,
        limit,
        planType,
        remaining: limit,
      };
    }

    const uniqueGenerations = new Set();
    posts?.forEach((post) => {
      const timestamp = new Date(post.generated_at).toISOString().slice(0, 16);
      uniqueGenerations.add(`${post.document_id}-${timestamp}`);
    });

    const currentUsage = uniqueGenerations.size;
    const remaining = Math.max(0, limit - currentUsage);

    if (currentUsage >= limit) {
      return {
        canGenerate: false,
        message: `AI generation limit reached (${limit} times). ${
          planType === "free"
            ? "Upgrade to Pro for 100 generations."
            : "You've used all your Pro generations."
        }`,
        currentUsage,
        limit,
        planType,
        remaining: 0,
      };
    }

    return {
      canGenerate: true,
      currentUsage,
      limit,
      planType,
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

export const checkWeeklyPostLimit = async (
  workspaceId: string,
  userId: string
): Promise<{
  canPost: boolean;
  message?: string;
  postsThisWeek: number;
  limit: number;
  planType: string;
  nextResetDate: string;
}> => {
  try {
    // Get user plan
    const { data: userPlan } = await supabaseAdmin
      .from("users_plans")
      .select("*, plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const planType = userPlan?.plans?.limit?.plan_type || "free";

    if (planType === "pro") {
      return {
        canPost: true,
        postsThisWeek: 0,
        limit: 0, // 0 means unlimited
        planType,
        nextResetDate: new Date().toISOString(),
      };
    }

    const limit = 2;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, etc.

    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysSinceMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    // Next reset date (next Monday)
    const nextResetDate = new Date(startOfWeek);
    nextResetDate.setDate(startOfWeek.getDate() + 7);

    const { data: postsThisWeek, error } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", startOfWeek.toISOString())
      .lte("created_at", endOfWeek.toISOString())
      .in("status", ["scheduled", "published"]);

    if (error) {
      console.error("❌ Error fetching weekly posts:", error);
      return {
        canPost: false,
        message: "Error checking weekly limit",
        postsThisWeek: 0,
        limit,
        planType,
        nextResetDate: nextResetDate.toISOString(),
      };
    }

    const postsCount = postsThisWeek?.length || 0;

    if (postsCount >= limit) {
      return {
        canPost: false,
        message: `Weekly limit reached! You've posted ${postsCount} times this week. You can post again from ${nextResetDate.toLocaleDateString()}.`,
        postsThisWeek: postsCount,
        limit,
        planType,
        nextResetDate: nextResetDate.toISOString(),
      };
    }

    return {
      canPost: true,
      postsThisWeek: postsCount,
      limit,
      planType,
      nextResetDate: nextResetDate.toISOString(),
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

export const checkPostGenerationLimit = async (
  workspaceId: string,
  userId: string
): Promise<LimitCheckResponse> => {
  try {
    // Check AI generation limit first
    const aiLimitCheck = await checkAIGenerationLimit(workspaceId, userId);
    if (!aiLimitCheck.canGenerate) {
      return {
        canGenerate: false,
        message: aiLimitCheck.message,
        currentUsage: aiLimitCheck.currentUsage,
        limit: aiLimitCheck.limit,
        planType: aiLimitCheck.planType,
        remainingAIGenerations: 0,
        totalAIGenerations: aiLimitCheck.limit,
      };
    }

    const { data: userPlan, error: planError } = await supabaseAdmin
      .from("users_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    let planData;

    if (userPlan && !planError) {
      const { data: planDetails, error: planDetailsError } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("id", userPlan.subs_plan_id)
        .single();

      if (planDetails && !planDetailsError) {
        planData = planDetails.limit;
      }
    }

    if (planError || !userPlan || !planData) {
      const { data: workspaceMember } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .single();

      if (!workspaceMember) {
        return {
          canGenerate: false,
          message: "No workspace access found",
          currentUsage: 0,
          limit: 0,
          planType: "none",
          remainingAIGenerations:
            aiLimitCheck.limit - aiLimitCheck.currentUsage,
          totalAIGenerations: aiLimitCheck.limit,
        };
      }

      const freePlan = {
        plan_type: "free",
        post_limit: "2",
        post_frequency: "weekly",
      };

      return await checkUsageWithPlan(
        workspaceId,
        userId,
        freePlan,
        aiLimitCheck
      );
    }

    return await checkUsageWithPlan(
      workspaceId,
      userId,
      planData,
      aiLimitCheck
    );
  } catch (error) {
    console.error("❌ Error in limit check:", error);
    return {
      canGenerate: false,
      message: "Error checking limits",
      currentUsage: 0,
      limit: 0,
      planType: "none",
      remainingAIGenerations: 0,
      totalAIGenerations: 10,
    };
  }
};

const checkUsageWithPlan = async (
  workspaceId: string,
  userId: string,
  planData: any,
  aiLimitCheck: any
): Promise<LimitCheckResponse> => {
  const planType = planData.plan_type || "free";
  const postLimit = parseInt(planData.post_limit || "2");
  const postFrequency = planData.post_frequency || "weekly";

  const now = new Date();
  let startDate: Date, endDate: Date;

  if (postFrequency === "weekly") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    startDate = startOfWeek;
    endDate = endOfWeek;
  } else {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  const { data: posts, error: postsError } = await supabaseAdmin
    .from("generated_posts")
    .select("id, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .gte("updated_at", startDate.toISOString())
    .lte("updated_at", endDate.toISOString());

  if (postsError) {
    console.error("❌ Error fetching posts:", postsError);
    return {
      canGenerate: false,
      message: "Error checking usage",
      currentUsage: 0,
      limit: postLimit,
      planType,
      remainingAIGenerations: aiLimitCheck.limit - aiLimitCheck.currentUsage,
      totalAIGenerations: aiLimitCheck.limit,
    };
  }

  const currentUsage = posts?.length || 0;

  if (planType === "free") {
    if (currentUsage >= postLimit) {
      const message =
        postFrequency === "weekly"
          ? `Weekly post limit (${postLimit}) exceeded. Upgrade to pro plan to generate unlimited posts daily.`
          : `Daily post limit (${postLimit}) exceeded. Upgrade to pro plan to generate more posts.`;

      return {
        canGenerate: false,
        message,
        currentUsage,
        limit: postLimit,
        planType,
        remainingAIGenerations: aiLimitCheck.limit - aiLimitCheck.currentUsage,
        totalAIGenerations: aiLimitCheck.limit,
      };
    }
  }

  if (planType === "pro" && postLimit === 0) {
    return {
      canGenerate: true,
      currentUsage,
      limit: -1,
      planType,
      remainingAIGenerations: aiLimitCheck.limit - aiLimitCheck.currentUsage,
      totalAIGenerations: aiLimitCheck.limit,
    };
  }

  if (planType === "pro" && currentUsage >= postLimit) {
    return {
      canGenerate: false,
      message: `Daily post limit (${postLimit}) exceeded.`,
      currentUsage,
      limit: postLimit,
      planType,
      remainingAIGenerations: aiLimitCheck.limit - aiLimitCheck.currentUsage,
      totalAIGenerations: aiLimitCheck.limit,
    };
  }

  return {
    canGenerate: true,
    currentUsage,
    limit: postLimit,
    planType,
    remainingAIGenerations: aiLimitCheck.limit - aiLimitCheck.currentUsage,
    totalAIGenerations: aiLimitCheck.limit,
  };
};
