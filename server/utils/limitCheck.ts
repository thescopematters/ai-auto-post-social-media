import supabaseAdmin from "../config/database";

export const checkPostGenerationLimit = async (
  workspaceId: string,
  userId: string
): Promise<{
  canGenerate: boolean;
  message?: string;
  currentUsage?: number;
  limit?: number;
  planType?: string;
}> => {
  try {
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
      // Check if user is member of this workspace
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
        };
      }

      const freePlan = {
        plan_type: "free",
        post_limit: "2", // 2 posts per week
        post_frequency: "weekly",
      };

      return await checkUsageWithPlan(workspaceId, userId, freePlan);
    }

    return await checkUsageWithPlan(workspaceId, userId, planData);
  } catch (error) {
    console.error("❌ Error in limit check:", error);
    return {
      canGenerate: false,
      message: "Error checking limits",
      currentUsage: 0,
      limit: 0,
      planType: "none",
    };
  }
};

const checkUsageWithPlan = async (
  workspaceId: string,
  userId: string,
  planData: any
) => {
  const planType = planData.plan_type || "free";
  const postLimit = parseInt(planData.post_limit || "2");
  const postFrequency = planData.post_frequency || "weekly";

  const now = new Date();
  let startDate: Date, endDate: Date;

  if (postFrequency === "weekly") {
    // Weekly limits - current week (Sunday to Saturday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    startDate = startOfWeek;
    endDate = endOfWeek;
  } else {
    // Daily limits - current day
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
      };
    }
  }

  if (planType === "pro" && postLimit === 0) {
    return {
      canGenerate: true,
      currentUsage,
      limit: -1, // -1 means unlimited
      planType,
    };
  }

  if (planType === "pro" && currentUsage >= postLimit) {
    return {
      canGenerate: false,
      message: `Daily post limit (${postLimit}) exceeded.`,
      currentUsage,
      limit: postLimit,
      planType,
    };
  }

  return {
    canGenerate: true,
    currentUsage,
    limit: postLimit,
    planType,
  };
};
