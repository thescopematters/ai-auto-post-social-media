export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          company_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          brand_color: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          brand_color?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          brand_color?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "admin" | "editor" | "viewer";
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "admin" | "editor" | "viewer";
          joined_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "admin" | "editor" | "viewer";
          joined_at?: string;
        };
      };
      social_accounts: {
        Row: {
          id: string;
          workspace_id: string;
          platform: "linkedin" | "twitter";
          account_name: string;
          account_id: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          is_active: boolean;
          connected_at: string;
          last_sync: string | null;
          photo?: string | null;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          platform: "linkedin" | "twitter";
          account_name: string;
          account_id: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          is_active?: boolean;
          connected_at?: string;
          last_sync?: string | null;
          photo?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          platform?: "linkedin" | "twitter";
          account_name?: string;
          account_id?: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          is_active?: boolean;
          connected_at?: string;
          last_sync?: string | null;
          photo?: string | null;
          updated_at?: string;
        };
      };
      ai_agent_configs: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          tone:
          | "professional"
          | "casual"
          | "thought_leader"
          | "educational"
          | "promotional";
          style: Json;
          intent: "engagement" | "lead_gen" | "brand_awareness" | "education";
          hashtag_strategy: Json;
          cta_template: string | null;
          posting_frequency: Json;
          platform_settings: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          tone?:
          | "professional"
          | "casual"
          | "thought_leader"
          | "educational"
          | "promotional";
          style?: Json;
          intent?: "engagement" | "lead_gen" | "brand_awareness" | "education";
          hashtag_strategy?: Json;
          cta_template?: string | null;
          posting_frequency?: Json;
          platform_settings?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          tone?:
          | "professional"
          | "casual"
          | "thought_leader"
          | "educational"
          | "promotional";
          style?: Json;
          intent?: "engagement" | "lead_gen" | "brand_awareness" | "education";
          hashtag_strategy?: Json;
          cta_template?: string | null;
          posting_frequency?: Json;
          platform_settings?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          uploaded_by: string | null;
          title: string;
          file_type: "pdf" | "docx" | "txt" | "url" | "manual";
          file_url: string | null;
          file_size: number;
          content_text: string | null;
          metadata: Json;
          processing_status: "pending" | "processing" | "completed" | "failed";
          processing_error: string | null;
          uploaded_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          uploaded_by?: string | null;
          title: string;
          file_type: "pdf" | "docx" | "txt" | "url" | "manual";
          file_url?: string | null;
          file_size?: number;
          content_text?: string | null;
          metadata?: Json;
          processing_status?: "pending" | "processing" | "completed" | "failed";
          processing_error?: string | null;
          uploaded_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          uploaded_by?: string | null;
          title?: string;
          file_type?: "pdf" | "docx" | "txt" | "url" | "manual";
          file_url?: string | null;
          file_size?: number;
          content_text?: string | null;
          metadata?: Json;
          processing_status?: "pending" | "processing" | "completed" | "failed";
          processing_error?: string | null;
          uploaded_at?: string;
          processed_at?: string | null;
        };
      };
      generated_posts: {
        Row: {
          id: string;
          workspace_id: string;
          document_id: string | null;
          agent_config_id: string | null;
          platform: "linkedin" | "twitter";
          content: string;
          variant_number: number;
          hashtags: string[];
          media_urls: string[];
          predicted_score: number;
          moderation_status: "pending" | "approved" | "rejected" | "flagged";
          moderation_notes: string | null;
          moderated_by: string | null;
          moderated_at: string | null;
          generated_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          document_id?: string | null;
          agent_config_id?: string | null;
          platform: "linkedin" | "twitter";
          content: string;
          variant_number?: number;
          hashtags?: string[];
          media_urls?: string[];
          predicted_score?: number;
          moderation_status?: "pending" | "approved" | "rejected" | "flagged";
          moderation_notes?: string | null;
          moderated_by?: string | null;
          moderated_at?: string | null;
          generated_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          document_id?: string | null;
          agent_config_id?: string | null;
          platform?: "linkedin" | "twitter";
          content?: string;
          variant_number?: number;
          hashtags?: string[];
          media_urls?: string[];
          predicted_score?: number;
          moderation_status?: "pending" | "approved" | "rejected" | "flagged";
          moderation_notes?: string | null;
          moderated_by?: string | null;
          moderated_at?: string | null;
          generated_at?: string;
          updated_at?: string;
        };
      };
      scheduled_posts: {
        Row: {
          id: string;
          workspace_id: string;
          post_id: string;
          social_account_id: string;
          scheduled_time: string;
          status: "scheduled" | "published" | "failed" | "cancelled";
          published_at: string | null;
          platform_post_id: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          timezone?: string | null;
          external_post_id?: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          post_id: string;
          social_account_id: string;
          scheduled_time: string;
          status?: "scheduled" | "published" | "failed" | "cancelled";
          published_at?: string | null;
          platform_post_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          timezone?: string | null;
          external_post_id?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          post_id?: string;
          social_account_id?: string;
          scheduled_time?: string;
          status?: "scheduled" | "published" | "failed" | "cancelled";
          published_at?: string | null;
          platform_post_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          timezone?: string | null;
          external_post_id?: string | null;
        };
      };
      post_analytics: {
        Row: {
          id: string;
          scheduled_post_id: string;
          platform: string;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          clicks_count: number;
          impressions_count: number;
          engagement_rate: number;
          fetched_at: string;
          metrics_data: Json;
        };
        Insert: {
          id?: string;
          scheduled_post_id: string;
          platform: string;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          clicks_count?: number;
          impressions_count?: number;
          engagement_rate?: number;
          fetched_at?: string;
          metrics_data?: Json;
        };
        Update: {
          id?: string;
          scheduled_post_id?: string;
          platform?: string;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          clicks_count?: number;
          impressions_count?: number;
          engagement_rate?: number;
          fetched_at?: string;
          metrics_data?: Json;
        };
      };
      moderation_logs: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          action: "approved" | "rejected" | "flagged" | "revised";
          reason: string | null;
          previous_status: string | null;
          new_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          action: "approved" | "rejected" | "flagged" | "revised";
          reason?: string | null;
          previous_status?: string | null;
          new_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          action?: "approved" | "rejected" | "flagged" | "revised";
          reason?: string | null;
          previous_status?: string | null;
          new_status?: string | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          tier: "free" | "pro" | "enterprise";
          status: "active" | "cancelled" | "past_due" | "trialing";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          usage_limits: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          tier?: "free" | "pro" | "enterprise";
          status?: "active" | "cancelled" | "past_due" | "trialing";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          usage_limits?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          tier?: "free" | "pro" | "enterprise";
          status?: "active" | "cancelled" | "past_due" | "trialing";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          usage_limits?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_transactions: {
        Row: {
          id: string;
          user_id: string;
          merchant_transaction_id: string;
          amount: number;
          status: string;
          plan_id: string;
          phonepe_order_id: string,
          payment_method: string | null;
          phonepe_reference_id: string | null;
          created_at: string;
          updated_at: string;
          period_start: string | null;
          period_end: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          merchant_transaction_id: string;
          amount: number;
          status?: string;
          plan_id: string;
          phonepe_order_id: string,
          payment_method?: string | null;
          phonepe_reference_id?: string | null;
          created_at?: string;
          updated_at?: string;
          period_start?: string | null;
          period_end?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          merchant_transaction_id?: string;
          amount?: number;
          status?: string;
          phonepe_order_id: string,
          plan_id: string;
          payment_method?: string | null;
          phonepe_reference_id?: string | null;
          created_at?: string;
          updated_at?: string;
          period_start?: string | null;
          period_end?: string | null;
        };
      };
      post_media: {
        Row: {
          id: string;
          workspace_id: string;
          post_id: string;
          media_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          type: "img" | "pdf" | "doc";
          status: "active" | "inactive" | "deleted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          post_id: string;
          media_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          type: "img" | "pdf" | "doc";
          status?: "active" | "inactive" | "deleted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          post_id?: string;
          media_path?: string;
          file_name?: string;
          file_size?: number;
          mime_type?: string;
          type?: "img" | "pdf" | "doc";
          status?: "active" | "inactive" | "deleted";
          created_at?: string;
          updated_at?: string;
        };
      };
      user_usage_limits: {
        Row: {
          id: string;
          user_id: string;
          usage_data: {
            total_ai_generations: number;
            total_documents: number;
            weekly_posts_count: number;
            week_start_date: string | null;
            next_reset_date: string | null;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          usage_data?: {
            total_ai_generations?: number;
            total_documents?: number;
            weekly_posts_count?: number;
            week_start_date?: string | null;
            next_reset_date?: string | null;
          };
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          usage_data?: {
            total_ai_generations?: number;
            total_documents?: number;
            weekly_posts_count?: number;
            week_start_date?: string | null;
            next_reset_date?: string | null;
          };
          created_at?: string;
          updated_at?: string;
        };
      };
      platform_usage: {
        Row: {
          id: string;
          user_id: string;
          platform: "linkedin" | "twitter" | "facebook" | "instagram";
          platform_data: {
            ai_generations_count: number;
            published_posts_count: number;
            scheduled_posts_count: number;
            last_activity: string | null;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: "linkedin" | "twitter" | "facebook" | "instagram";
          platform_data?: {
            ai_generations_count?: number;
            published_posts_count?: number;
            scheduled_posts_count?: number;
            last_activity?: string | null;
          };
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          platform?: "linkedin" | "twitter" | "facebook" | "instagram";
          platform_data?: {
            ai_generations_count?: number;
            published_posts_count?: number;
            scheduled_posts_count?: number;
            last_activity?: string | null;
          };
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}