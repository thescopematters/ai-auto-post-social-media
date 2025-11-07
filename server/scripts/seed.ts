// @ts-nocheck
import supabaseAdmin from "../config/database";
import logger from "../config/logger";

const seedDatabase = async () => {
  try {
    logger.info("Starting database seeding...");

    logger.info("Seeding subscription plans...");

    const plans = [
      {
        plans_name: "Free Plan",
        status: "active",
        limit: {
          plan_type: "free",
          post_limit: "2",
          post_frequency: "weekly",
        },
      },
      {
        plans_name: "Pro Plan",
        status: "active",
        limit: {
          plan_type: "pro",
          post_limit: "0",
          post_frequency: "daily",
        },
      },
    ];

    // Check if plans already exist
    const { data: existingPlans, error: checkError } = await supabaseAdmin
      .from("plans")
      .select("id, plans_name");

    if (checkError) {
      logger.warn("Error checking existing plans:", checkError);
    }

    if (!existingPlans || existingPlans.length === 0) {
      const { data: seededPlans, error: planError } = await supabaseAdmin
        .from("plans")
        .insert(plans)
        .select();

      if (planError) {
        logger.error("Error seeding plans:", planError);
      } else {
        logger.info(`✅ Created ${seededPlans?.length} plans`);
      }
    } else {
      logger.info(
        `✅ Plans already exist: ${existingPlans
          .map((p) => p.plans_name)
          .join(", ")}`
      );
    }

    const demoUser1 = await supabaseAdmin.auth.admin.createUser({
      email: "demo@contentai.com",
      password: "Demo123456!",
      email_confirm: true,
    });

    if (!demoUser1.data.user) {
      throw new Error("Failed to create demo user");
    }

    await supabaseAdmin.from("profiles").insert({
      id: demoUser1.data.user.id,
      email: "demo@contentai.com",
      full_name: "Demo User",
      company_name: "ContentAI Demo",
      role: "user",
    } as any);

    logger.info("Created demo user");

    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name: "Demo Workspace",
        owner_id: demoUser1.data.user.id,
        brand_color: "#3B82F6",
      } as any)
      .select()
      .single();

    if (!workspace) {
      throw new Error("Failed to create workspace");
    }

    logger.info("Created workspace");

    await supabaseAdmin.from("subscriptions").insert({
      workspace_id: workspace.id,
      tier: "pro",
      status: "active",
      usage_limits: {
        posts_per_month: -1,
        ai_generations: -1,
        workspaces: 3,
      },
    });

    await supabaseAdmin.from("ai_agent_configs").insert({
      workspace_id: workspace.id,
      name: "Default Professional Agent",
      tone: "professional",
      style: { writing_style: "concise", personality: "authoritative" },
      intent: "engagement",
      hashtag_strategy: { max_hashtags: 5, relevance_threshold: 0.8 },
      posting_frequency: { daily: 2, weekly: 10 },
      platform_settings: {
        linkedin: { max_length: 3000 },
        twitter: { max_length: 280 },
      },
      is_default: true,
    });

    logger.info("Created subscription and AI config");

    const documents = [
      {
        title: "The Future of AI in Marketing",
        file_type: "manual",
        content_text: `Artificial intelligence is revolutionizing the marketing landscape. From predictive analytics to personalized customer experiences, AI is enabling marketers to make data-driven decisions faster than ever before. Companies that embrace AI-powered tools are seeing significant improvements in customer engagement, conversion rates, and ROI.`,
        processing_status: "completed",
      },
      {
        title: "Social Media Trends 2024",
        file_type: "manual",
        content_text: `Short-form video content continues to dominate social media platforms. Brands are finding success with authentic, behind-the-scenes content that humanizes their business. User-generated content and influencer partnerships remain powerful strategies for building trust and expanding reach.`,
        processing_status: "completed",
      },
      {
        title: "Content Marketing Best Practices",
        file_type: "manual",
        content_text: `Effective content marketing starts with understanding your audience. Create buyer personas, map the customer journey, and develop content that addresses pain points at each stage. Consistency is key - maintain a regular publishing schedule and repurpose high-performing content across multiple channels.`,
        processing_status: "completed",
      },
    ];

    for (const doc of documents) {
      await supabaseAdmin.from("documents").insert({
        workspace_id: workspace.id,
        uploaded_by: demoUser1.data.user.id,
        title: doc.title,
        file_type: doc.file_type,
        content_text: doc.content_text,
        file_size: doc.content_text.length,
        metadata: {},
        processing_status: doc.processing_status,
      });
    }

    logger.info("Created sample documents");

    const { data: docForPosts } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .single();

    if (docForPosts) {
      const posts = [
        {
          platform: "linkedin",
          content: `🚀 AI is transforming marketing!\n\nCompanies using AI-powered tools are seeing:\n📈 Higher engagement rates\n💰 Better ROI\n⚡ Faster decision-making\n\nThe future of marketing is intelligent, data-driven, and customer-centric.\n\n#AIMarketing #DigitalTransformation #MarTech`,
          moderation_status: "approved",
        },
        {
          platform: "twitter",
          content: `AI in marketing isn't science fiction anymore.\n\nIt's happening now, and it's powerful.\n\nCompanies that adapt win. Those that don't... well. 🤷‍♂️\n\n#AI #Marketing`,
          moderation_status: "approved",
        },
        {
          platform: "linkedin",
          content: `📊 Data shows AI adoption in marketing delivers real results.\n\nBut it's not about replacing human creativity—it's about augmenting it.\n\nThe best campaigns combine AI efficiency with human insight.\n\nWhat's your take on AI in marketing?\n\n#Marketing #Innovation`,
          moderation_status: "pending",
        },
      ];

      for (let i = 0; i < posts.length; i++) {
        await supabaseAdmin.from("generated_posts").insert({
          workspace_id: workspace.id,
          document_id: docForPosts.id,
          platform: posts[i].platform,
          content: posts[i].content,
          variant_number: i + 1,
          hashtags: [],
          media_urls: [],
          predicted_score: 7 + Math.random() * 3,
          moderation_status: posts[i].moderation_status,
          moderated_by:
            posts[i].moderation_status === "approved"
              ? demoUser1.data.user.id
              : null,
          moderated_at:
            posts[i].moderation_status === "approved"
              ? new Date().toISOString()
              : null,
        } as any);
      }

      logger.info("Created sample posts");
    }

    logger.info("✅ Database seeding completed successfully!");
    logger.info("");
    logger.info("Demo credentials:");
    logger.info("Email: demo@contentai.com");
    logger.info("Password: Demo123456!");
  } catch (error) {
    logger.error("Error seeding database:", error);
    throw error;
  }
};

seedDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seeding failed:", error);
    process.exit(1);
  });
