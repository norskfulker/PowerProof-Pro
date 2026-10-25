export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_days: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_action_items: {
        Row: {
          body: string | null
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          idempotency_key: string
          instance_id: string
          kind: string
          payload: Json
          ref_id: string | null
          ref_type: string | null
          snooze_until: string | null
          status: string
          store_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          idempotency_key: string
          instance_id: string
          kind: string
          payload?: Json
          ref_id?: string | null
          ref_type?: string | null
          snooze_until?: string | null
          status?: string
          store_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          idempotency_key?: string
          instance_id?: string
          kind?: string
          payload?: Json
          ref_id?: string | null
          ref_type?: string | null
          snooze_until?: string | null
          status?: string
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          meta: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      agent_catalog: {
        Row: {
          category: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          name: string
          sort: number
          status: string
          tagline: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id: string
          name: string
          sort?: number
          status?: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          sort?: number
          status?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          label: string
          last_checked_at: string | null
          last_error: string | null
          secret_enc: string | null
          status: string
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          last_checked_at?: string | null
          last_error?: string | null
          secret_enc?: string | null
          status?: string
          store_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          last_checked_at?: string | null
          last_error?: string | null
          secret_enc?: string | null
          status?: string
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_consents: {
        Row: {
          accepted_at: string
          id: string
          instance_id: string
          store_id: string
          text: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          id?: string
          instance_id: string
          store_id: string
          text: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          id?: string
          instance_id?: string
          store_id?: string
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_consents_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_consents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_credit_ledger: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string | null
          delta: number
          id: number
          idempotency_key: string
          kind: string
          reason: string | null
          ref: string | null
          store_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          delta: number
          id?: never
          idempotency_key: string
          kind: string
          reason?: string | null
          ref?: string | null
          store_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: never
          idempotency_key?: string
          kind?: string
          reason?: string | null
          ref?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_credit_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_demand_requests: {
        Row: {
          agent_id: string
          created_at: string
          email: string
          id: string
          mobile: string | null
          note: string | null
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          email: string
          id?: string
          mobile?: string | null
          note?: string | null
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          email?: string
          id?: string
          mobile?: string | null
          note?: string | null
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_demand_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_demand_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instance_connections: {
        Row: {
          connection_id: string
          connector_key: string
          instance_id: string
          store_id: string
        }
        Insert: {
          connection_id: string
          connector_key: string
          instance_id: string
          store_id: string
        }
        Update: {
          connection_id?: string
          connector_key?: string
          instance_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instance_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instance_connections_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instance_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instances: {
        Row: {
          agent_id: string
          consent_at: string | null
          consent_by: string | null
          created_at: string
          created_by: string | null
          id: string
          last_run_at: string | null
          next_run_at: string | null
          paused_reason: string | null
          run_every_minutes: number | null
          run_lock_until: string | null
          settings: Json
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          consent_at?: string | null
          consent_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          paused_reason?: string | null
          run_every_minutes?: number | null
          run_lock_until?: string | null
          settings?: Json
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          consent_at?: string | null
          consent_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          paused_reason?: string | null
          run_every_minutes?: number | null
          run_lock_until?: string | null
          settings?: Json
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          instance_id: string | null
          kind: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          payload: Json
          run_at: string
          run_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          instance_id?: string | null
          kind: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          run_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          instance_id?: string | null
          kind?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          run_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_llm_cache: {
        Row: {
          body: string
          cache_key: string
          created_at: string
          store_id: string
          subject: string | null
        }
        Insert: {
          body: string
          cache_key: string
          created_at?: string
          store_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          cache_key?: string
          created_at?: string
          store_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_llm_cache_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_llm_usage: {
        Row: {
          agent_id: string
          created_at: string
          id: number
          input_tokens: number
          model: string
          ok: boolean
          output_tokens: number
          provider: string
          store_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: never
          input_tokens?: number
          model: string
          ok?: boolean
          output_tokens?: number
          provider: string
          store_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: never
          input_tokens?: number
          model?: string
          ok?: boolean
          output_tokens?: number
          provider?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_llm_usage_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages_outbox: {
        Row: {
          agent_id: string
          body: string
          channel: string
          contact_key: string
          created_at: string
          credit_reason: string | null
          credits: number
          error: string | null
          id: string
          idempotency_key: string
          instance_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          store_id: string
          subject: string | null
          to_address: string
        }
        Insert: {
          agent_id: string
          body: string
          channel: string
          contact_key: string
          created_at?: string
          credit_reason?: string | null
          credits?: number
          error?: string | null
          id?: string
          idempotency_key: string
          instance_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          store_id: string
          subject?: string | null
          to_address: string
        }
        Update: {
          agent_id?: string
          body?: string
          channel?: string
          contact_key?: string
          created_at?: string
          credit_reason?: string | null
          credits?: number
          error?: string | null
          id?: string
          idempotency_key?: string
          instance_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          store_id?: string
          subject?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_outbox_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_outbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_optouts: {
        Row: {
          address_hash: string
          channel: string
          created_at: string
          source: string
          store_id: string
        }
        Insert: {
          address_hash: string
          channel: string
          created_at?: string
          source?: string
          store_id: string
        }
        Update: {
          address_hash?: string
          channel?: string
          created_at?: string
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_optouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_payment_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          gateway: string
          id: number
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          gateway?: string
          id?: never
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          gateway?: string
          id?: never
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      agent_plans: {
        Row: {
          active: boolean
          agent_id: string
          created_at: string
          currency: string
          id: string
          included_credits: number
          launch_price_minor: number | null
          name: string
          price_minor: number
          razorpay_plan_id: string | null
        }
        Insert: {
          active?: boolean
          agent_id: string
          created_at?: string
          currency?: string
          id: string
          included_credits?: number
          launch_price_minor?: number | null
          name?: string
          price_minor: number
          razorpay_plan_id?: string | null
        }
        Update: {
          active?: boolean
          agent_id?: string
          created_at?: string
          currency?: string
          id?: string
          included_credits?: number
          launch_price_minor?: number | null
          name?: string
          price_minor?: number
          razorpay_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_plans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_platform_settings: {
        Row: {
          cost_rates: Json
          id: boolean
          llm_provider: string
          runs_enabled: boolean
          sending_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_rates?: Json
          id?: boolean
          llm_provider?: string
          runs_enabled?: boolean
          sending_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_rates?: Json
          id?: boolean
          llm_provider?: string
          runs_enabled?: boolean
          sending_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_reports: {
        Row: {
          created_at: string
          data: Json
          error: string | null
          id: string
          instance_id: string
          period_end: string
          period_start: string
          sent_at: string | null
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          instance_id: string
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          instance_id?: string
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reports_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_steps: {
        Row: {
          attempts: number
          error: string | null
          output: Json | null
          run_id: string
          status: string
          step: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          error?: string | null
          output?: Json | null
          run_id: string
          status: string
          step: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          error?: string | null
          output?: Json | null
          run_id?: string
          status?: string
          step?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_steps_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          dry_run: boolean
          error: string | null
          finished_at: string | null
          id: string
          instance_id: string
          started_at: string
          status: string
          store_id: string
          summary: Json
          trigger: string
        }
        Insert: {
          agent_id: string
          dry_run?: boolean
          error?: string | null
          finished_at?: string | null
          id?: string
          instance_id: string
          started_at?: string
          status?: string
          store_id: string
          summary?: Json
          trigger: string
        }
        Update: {
          agent_id?: string
          dry_run?: boolean
          error?: string | null
          finished_at?: string | null
          id?: string
          instance_id?: string
          started_at?: string
          status?: string
          store_id?: string
          summary?: Json
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_subscriptions: {
        Row: {
          agent_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          razorpay_subscription_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_support_items: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          context: Json
          created_at: string
          id: string
          instance_id: string | null
          kind: string
          message: string
          status: string
          store_id: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          context?: Json
          created_at?: string
          id?: string
          instance_id?: string | null
          kind: string
          message: string
          status?: string
          store_id: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          context?: Json
          created_at?: string
          id?: string
          instance_id?: string | null
          kind?: string
          message?: string
          status?: string
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_support_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_support_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          kind: string
          owner_id: string
          prompt: string
          result_path: string | null
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          kind?: string
          owner_id: string
          prompt: string
          result_path?: string | null
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          kind?: string
          owner_id?: string
          prompt?: string
          result_path?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          meta: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      billing_receipts: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          period_end: string | null
          period_start: string | null
          razorpay_payment_id: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          razorpay_payment_id?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          razorpay_payment_id?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_receipts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          created_at: string
          current_end: string | null
          current_start: string | null
          id: string
          razorpay_customer_id: string
          razorpay_subscription_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          id?: string
          razorpay_customer_id?: string
          razorpay_subscription_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          id?: string
          razorpay_customer_id?: string
          razorpay_subscription_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string
          body: string
          cover_alt: string
          cover_kind: string
          cover_src: string
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: string
          cover_alt?: string
          cover_kind?: string
          cover_src?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          cover_alt?: string
          cover_kind?: string
          cover_src?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chaser_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_paused: boolean
          language_pref: string | null
          name: string
          notes: string | null
          opted_out_at: string | null
          phone_e164: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_paused?: boolean
          language_pref?: string | null
          name: string
          notes?: string | null
          opted_out_at?: string | null
          phone_e164?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_paused?: boolean
          language_pref?: string | null
          name?: string
          notes?: string | null
          opted_out_at?: string | null
          phone_e164?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaser_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chaser_imports: {
        Row: {
          created_at: string
          created_by: string | null
          error_report: Json
          file_name: string
          id: string
          is_full: boolean
          missing_invoice_ids: string[]
          rows_failed: number
          rows_imported: number
          rows_total: number
          rows_updated: number
          source: string
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_report?: Json
          file_name?: string
          id?: string
          is_full?: boolean
          missing_invoice_ids?: string[]
          rows_failed?: number
          rows_imported?: number
          rows_total?: number
          rows_updated?: number
          source: string
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_report?: Json
          file_name?: string
          id?: string
          is_full?: boolean
          missing_invoice_ids?: string[]
          rows_failed?: number
          rows_imported?: number
          rows_total?: number
          rows_updated?: number
          source?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaser_imports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chaser_invoices: {
        Row: {
          amount_paid_minor: number
          amount_total_minor: number
          created_at: string
          currency: string
          customer_id: string
          due_date: string
          id: string
          import_id: string | null
          invoice_date: string | null
          invoice_no: string
          paid_at: string | null
          source: string
          source_ref: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount_paid_minor?: number
          amount_total_minor: number
          created_at?: string
          currency?: string
          customer_id: string
          due_date: string
          id?: string
          import_id?: string | null
          invoice_date?: string | null
          invoice_no: string
          paid_at?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount_paid_minor?: number
          amount_total_minor?: number
          created_at?: string
          currency?: string
          customer_id?: string
          due_date?: string
          id?: string
          import_id?: string | null
          invoice_date?: string | null
          invoice_no?: string
          paid_at?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaser_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "chaser_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaser_invoices_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "chaser_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaser_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chaser_reminders: {
        Row: {
          anchor: string
          body: string
          channel: string
          created_at: string
          customer_id: string
          edited: boolean
          error: string | null
          facts: Json
          id: string
          idempotency_key: string
          invoice_ids: string[]
          language: string
          provider_message_id: string | null
          queued_at: string | null
          run_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          source: string
          stage: number
          status: string
          store_id: string
          subject: string | null
          template_body: string
          template_subject: string | null
          tone: string
          updated_at: string
        }
        Insert: {
          anchor: string
          body: string
          channel: string
          created_at?: string
          customer_id: string
          edited?: boolean
          error?: string | null
          facts?: Json
          id?: string
          idempotency_key: string
          invoice_ids?: string[]
          language: string
          provider_message_id?: string | null
          queued_at?: string | null
          run_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          source?: string
          stage: number
          status?: string
          store_id: string
          subject?: string | null
          template_body: string
          template_subject?: string | null
          tone: string
          updated_at?: string
        }
        Update: {
          anchor?: string
          body?: string
          channel?: string
          created_at?: string
          customer_id?: string
          edited?: boolean
          error?: string | null
          facts?: Json
          id?: string
          idempotency_key?: string
          invoice_ids?: string[]
          language?: string
          provider_message_id?: string | null
          queued_at?: string | null
          run_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          source?: string
          stage?: number
          status?: string
          store_id?: string
          subject?: string | null
          template_body?: string
          template_subject?: string | null
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaser_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "chaser_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaser_reminders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          bg: Json | null
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          store_id: string
        }
        Insert: {
          bg?: Json | null
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          store_id: string
        }
        Update: {
          bg?: Json | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string | null
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["discount_kind"]
          max_uses: number | null
          min_subtotal_minor: number
          product_id: string | null
          starts_at: string | null
          store_id: string
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["discount_kind"]
          max_uses?: number | null
          min_subtotal_minor?: number
          product_id?: string | null
          starts_at?: string | null
          store_id: string
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["discount_kind"]
          max_uses?: number | null
          min_subtotal_minor?: number
          product_id?: string | null
          starts_at?: string | null
          store_id?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_page_drafts: {
        Row: {
          data: Json
          page_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          page_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          page_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_page_drafts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "custom_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_page_drafts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_pages: {
        Row: {
          created_at: string
          id: string
          layout: Json
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["page_status"]
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["page_status"]
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["page_status"]
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          email: string
          note: string | null
          store_id: string
          tags: string[]
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          email: string
          note?: string | null
          store_id: string
          tags?: string[]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          email?: string
          note?: string | null
          store_id?: string
          tags?: string[]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string
          id: string
          name: string
          rules: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rules?: Json
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rules?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rules: {
        Row: {
          active: boolean
          bundle_price_currency: string | null
          bundle_price_minor: number | null
          created_at: string
          ends_at: string | null
          id: string
          name: string
          percent_bps: number | null
          reward: Database["public"]["Enums"]["reward_kind"]
          reward_product_id: string | null
          sort_order: number
          starts_at: string | null
          store_id: string
          trigger_product_ids: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          bundle_price_currency?: string | null
          bundle_price_minor?: number | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          percent_bps?: number | null
          reward: Database["public"]["Enums"]["reward_kind"]
          reward_product_id?: string | null
          sort_order?: number
          starts_at?: string | null
          store_id: string
          trigger_product_ids: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          bundle_price_currency?: string | null
          bundle_price_minor?: number | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          percent_bps?: number | null
          reward?: Database["public"]["Enums"]["reward_kind"]
          reward_product_id?: string | null
          sort_order?: number
          starts_at?: string | null
          store_id?: string
          trigger_product_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_rules_reward_product_id_fkey"
            columns: ["reward_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          gateway_dispute_id: string
          id: string
          order_id: string
          reason: string | null
          respond_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          gateway_dispute_id: string
          id?: string
          order_id: string
          reason?: string | null
          respond_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          gateway_dispute_id?: string
          id?: string
          order_id?: string
          reason?: string | null
          respond_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          error: string | null
          hostname: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          status: Database["public"]["Enums"]["domain_status"]
          store_id: string
          updated_at: string
          verified_at: string | null
          verify_token: string
          www_mode: Database["public"]["Enums"]["www_mode"]
        }
        Insert: {
          created_at?: string
          error?: string | null
          hostname: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          status?: Database["public"]["Enums"]["domain_status"]
          store_id: string
          updated_at?: string
          verified_at?: string | null
          verify_token?: string
          www_mode?: Database["public"]["Enums"]["www_mode"]
        }
        Update: {
          created_at?: string
          error?: string | null
          hostname?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          status?: Database["public"]["Enums"]["domain_status"]
          store_id?: string
          updated_at?: string
          verified_at?: string | null
          verify_token?: string
          www_mode?: Database["public"]["Enums"]["www_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      download_tokens: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string
          id: string
          max_downloads: number
          order_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at: string
          id?: string
          max_downloads?: number
          order_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          order_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          created_at: string
          id: string
          recipients: number
          sent_by: string | null
          store_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipients: number
          sent_by?: string | null
          store_id: string
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          recipients?: number
          sent_by?: string | null
          store_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          currency: string
          per_usd: number
          updated_at: string
        }
        Insert: {
          currency: string
          per_usd: number
          updated_at?: string
        }
        Update: {
          currency?: string
          per_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          data: Json
          email: string | null
          id: string
          kind: string
          name: string | null
          page_id: string | null
          phone: string | null
          slot_at: string | null
          slot_minutes: number | null
          store_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          email?: string | null
          id?: string
          kind: string
          name?: string | null
          page_id?: string | null
          phone?: string | null
          slot_at?: string | null
          slot_minutes?: number | null
          store_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          email?: string | null
          id?: string
          kind?: string
          name?: string | null
          page_id?: string | null
          phone?: string | null
          slot_at?: string | null
          slot_minutes?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "custom_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount_minor: number
          available_at: string | null
          created_at: string
          currency: string
          id: number
          kind: string
          order_id: string | null
          payout_id: string | null
          ref: string | null
          store_id: string
        }
        Insert: {
          account: string
          amount_minor: number
          available_at?: string | null
          created_at?: string
          currency: string
          id?: never
          kind: string
          order_id?: string | null
          payout_id?: string | null
          ref?: string | null
          store_id: string
        }
        Update: {
          account?: string
          amount_minor?: number
          available_at?: string | null
          created_at?: string
          currency?: string
          id?: never
          kind?: string
          order_id?: string | null
          payout_id?: string | null
          ref?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_deals: {
        Row: {
          billing: string
          billing_interval: string | null
          created_at: string
          ends_at: string | null
          id: string
          original_price_minor: number
          pitch: string
          price_minor: number
          product_id: string
          show_revenue: boolean
          status: string
          store_id: string
          title: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          billing?: string
          billing_interval?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          original_price_minor: number
          pitch: string
          price_minor: number
          product_id: string
          show_revenue?: boolean
          status?: string
          store_id: string
          title: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          billing?: string
          billing_interval?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          original_price_minor?: number
          pitch?: string
          price_minor?: number
          product_id?: string
          show_revenue?: boolean
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_deals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          area: string
          body: string | null
          created_at: string
          dedupe: string | null
          emailed_at: string | null
          href: string | null
          id: string
          kind: string
          read_at: string | null
          store_id: string
          title: string
        }
        Insert: {
          area?: string
          body?: string | null
          created_at?: string
          dedupe?: string | null
          emailed_at?: string | null
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          store_id: string
          title: string
        }
        Update: {
          area?: string
          body?: string | null
          created_at?: string
          dedupe?: string | null
          emailed_at?: string | null
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          amount_minor: number | null
          body: string | null
          created_at: string
          id: string
          kind: string
          order_id: string
          store_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          amount_minor?: number | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          order_id: string
          store_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          amount_minor?: number | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          discount_minor: number
          fulfilment: string
          hsn_sac: string | null
          id: string
          is_gift: boolean
          line_total_minor: number
          order_id: string
          product_id: string | null
          quantity: number
          tax_rate_bps: number
          title: string
          unit_price_minor: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          discount_minor?: number
          fulfilment?: string
          hsn_sac?: string | null
          id?: string
          is_gift?: boolean
          line_total_minor: number
          order_id: string
          product_id?: string | null
          quantity?: number
          tax_rate_bps?: number
          title: string
          unit_price_minor: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          discount_minor?: number
          fulfilment?: string
          hsn_sac?: string | null
          id?: string
          is_gift?: boolean
          line_total_minor?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          tax_rate_bps?: number
          title?: string
          unit_price_minor?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          available_at: string | null
          buyer_country: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          buyer_state: string | null
          cod_fee_minor: number
          consent_at: string
          coupon_id: string | null
          created_at: string
          currency: string
          deals_applied: Json
          delivered_at: string | null
          discount_minor: number
          fulfilment_status: string | null
          gateway: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          invoice_no: string | null
          invoice_path: string | null
          marketing_opt_in: boolean
          paid_at: string | null
          payment_method: string
          ref: string
          reminded_at: string | null
          ship_to: Json | null
          shipped_at: string | null
          shipping_minor: number
          status: Database["public"]["Enums"]["order_status"]
          stock_taken: boolean
          store_id: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          tracking: Json | null
          updated_at: string
        }
        Insert: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          buyer_state?: string | null
          cod_fee_minor?: number
          consent_at: string
          coupon_id?: string | null
          created_at?: string
          currency: string
          deals_applied?: Json
          delivered_at?: string | null
          discount_minor?: number
          fulfilment_status?: string | null
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          invoice_no?: string | null
          invoice_path?: string | null
          marketing_opt_in?: boolean
          paid_at?: string | null
          payment_method?: string
          ref?: string
          reminded_at?: string | null
          ship_to?: Json | null
          shipped_at?: string | null
          shipping_minor?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_taken?: boolean
          store_id: string
          subtotal_minor: number
          tax_minor?: number
          total_minor: number
          tracking?: Json | null
          updated_at?: string
        }
        Update: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string
          buyer_state?: string | null
          cod_fee_minor?: number
          consent_at?: string
          coupon_id?: string | null
          created_at?: string
          currency?: string
          deals_applied?: Json
          delivered_at?: string | null
          discount_minor?: number
          fulfilment_status?: string | null
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          invoice_no?: string | null
          invoice_path?: string | null
          marketing_opt_in?: boolean
          paid_at?: string | null
          payment_method?: string
          ref?: string
          reminded_at?: string | null
          ship_to?: Json | null
          shipped_at?: string | null
          shipping_minor?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_taken?: boolean
          store_id?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          tracking?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_last4: string | null
          asset: string | null
          bank_name: string | null
          created_at: string
          gateway_fund_account_id: string | null
          holder_name: string
          id: string
          ifsc: string | null
          is_default: boolean
          kind: string
          network: string | null
          owner_id: string
          updated_at: string
          upi_masked: string | null
          verified_at: string | null
          wallet_address: string | null
        }
        Insert: {
          account_last4?: string | null
          asset?: string | null
          bank_name?: string | null
          created_at?: string
          gateway_fund_account_id?: string | null
          holder_name: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          kind: string
          network?: string | null
          owner_id: string
          updated_at?: string
          upi_masked?: string | null
          verified_at?: string | null
          wallet_address?: string | null
        }
        Update: {
          account_last4?: string | null
          asset?: string | null
          bank_name?: string | null
          created_at?: string
          gateway_fund_account_id?: string | null
          holder_name?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          kind?: string
          network?: string | null
          owner_id?: string
          updated_at?: string
          upi_masked?: string | null
          verified_at?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_minor: number
          currency: string
          failure_reason: string | null
          fee_minor: number
          fx_rate: number | null
          gateway_payout_id: string | null
          id: string
          method_id: string
          owner_id: string
          payout_amount_minor: number | null
          payout_currency: string | null
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          currency: string
          failure_reason?: string | null
          fee_minor?: number
          fx_rate?: number | null
          gateway_payout_id?: string | null
          id?: string
          method_id: string
          owner_id: string
          payout_amount_minor?: number | null
          payout_currency?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          currency?: string
          failure_reason?: string | null
          fee_minor?: number
          fx_rate?: number | null
          gateway_payout_id?: string | null
          id?: string
          method_id?: string
          owner_id?: string
          payout_amount_minor?: number | null
          payout_currency?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          ai_credits_monthly: number
          ai_pages_daily: number
          custom_domain: boolean
          max_pages: number | null
          max_products: number | null
          max_stores: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps: number
          team_seats: number | null
        }
        Insert: {
          ai_credits_monthly: number
          ai_pages_daily?: number
          custom_domain?: boolean
          max_pages?: number | null
          max_products?: number | null
          max_stores?: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps?: number
          team_seats?: number | null
        }
        Update: {
          ai_credits_monthly?: number
          ai_pages_daily?: number
          custom_domain?: boolean
          max_pages?: number | null
          max_products?: number | null
          max_stores?: number | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps?: number
          team_seats?: number | null
        }
        Relationships: []
      }
      product_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          product_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          product_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          product_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt: string | null
          created_at: string
          focal_x: number
          focal_y: number
          id: string
          kind: string
          poster_url: string | null
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          focal_x?: number
          focal_y?: number
          id?: string
          kind: string
          poster_url?: string | null
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          focal_x?: number
          focal_y?: number
          id?: string
          kind?: string
          poster_url?: string | null
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_minor: number | null
          created_at: string
          id: string
          image_url: string | null
          options: Json
          price_minor: number
          product_id: string
          sku: string | null
          sort_order: number
          stock: number | null
          title: string
        }
        Insert: {
          compare_at_minor?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json
          price_minor: number
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number | null
          title: string
        }
        Update: {
          compare_at_minor?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json
          price_minor?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          compare_at_price_minor: number | null
          cover_bg: Json | null
          created_at: string
          currency: string
          description: string | null
          fulfilment: string
          hsn_sac: string | null
          id: string
          low_stock_at: number
          min_price_minor: number
          options: Json
          paused_by_switch: boolean
          price_minor: number
          product_type: string
          publish_at: string | null
          sku: string | null
          slug: string
          source_url: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number | null
          store_id: string
          tax_rate_bps: number
          title: string
          track_stock: boolean
          unpublish_at: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          compare_at_price_minor?: number | null
          cover_bg?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          fulfilment?: string
          hsn_sac?: string | null
          id?: string
          low_stock_at?: number
          min_price_minor?: number
          options?: Json
          paused_by_switch?: boolean
          price_minor?: number
          product_type?: string
          publish_at?: string | null
          sku?: string | null
          slug: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id: string
          tax_rate_bps?: number
          title: string
          track_stock?: boolean
          unpublish_at?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          compare_at_price_minor?: number | null
          cover_bg?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          fulfilment?: string
          hsn_sac?: string | null
          id?: string
          low_stock_at?: number
          min_price_minor?: number
          options?: Json
          paused_by_switch?: boolean
          price_minor?: number
          product_type?: string
          publish_at?: string | null
          sku?: string | null
          slug?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id?: string
          tax_rate_bps?: number
          title?: string
          track_stock?: boolean
          unpublish_at?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          notify: Json
          onboarding: Json
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          notify?: Json
          onboarding?: Json
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          notify?: Json
          onboarding?: Json
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          asker_email: string
          asker_name: string
          body: string
          created_at: string
          id: string
          product_id: string
          status: Database["public"]["Enums"]["moderation_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asker_email: string
          asker_name: string
          body: string
          created_at?: string
          id?: string
          product_id: string
          status?: Database["public"]["Enums"]["moderation_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asker_email?: string
          asker_name?: string
          body?: string
          created_at?: string
          id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["moderation_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          created_at: string
          gateway_refund_id: string | null
          id: string
          order_id: string
          reason: string | null
          status: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          order_id: string
          reason?: string | null
          status?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_email: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          store_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_email?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          store_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_email?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          store_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      review_emails: {
        Row: {
          created_at: string
          email: string
          product_id: string
          review_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          email: string
          product_id: string
          review_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          email?: string
          product_id?: string
          review_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_emails_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_emails_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "creator_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_emails_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_emails_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          creator_reply: string | null
          id: string
          order_id: string | null
          photos: string[]
          pinned: boolean
          product_id: string
          rating: number
          replied_at: string | null
          reviewer_name: string
          status: Database["public"]["Enums"]["moderation_status"]
          store_id: string
          title: string | null
          updated_at: string
          verified: boolean | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          creator_reply?: string | null
          id?: string
          order_id?: string | null
          photos?: string[]
          pinned?: boolean
          product_id: string
          rating: number
          replied_at?: string | null
          reviewer_name: string
          status?: Database["public"]["Enums"]["moderation_status"]
          store_id: string
          title?: string | null
          updated_at?: string
          verified?: boolean | null
        }
        Update: {
          body?: string | null
          created_at?: string
          creator_reply?: string | null
          id?: string
          order_id?: string | null
          photos?: string[]
          pinned?: boolean
          product_id?: string
          rating?: number
          replied_at?: string | null
          reviewer_name?: string
          status?: Database["public"]["Enums"]["moderation_status"]
          store_id?: string
          title?: string | null
          updated_at?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "creator_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_claims: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          keep_previous: boolean
          kind: string
          note: string | null
          status: string
          store_id: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          keep_previous?: boolean
          kind: string
          note?: string | null
          status?: string
          store_id: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          keep_previous?: boolean
          kind?: string
          note?: string | null
          status?: string
          store_id?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_claims_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          path: string
          product_id: string | null
          session: string
          source: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          path: string
          product_id?: string | null
          session: string
          source?: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          path?: string
          product_id?: string | null
          session?: string
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_imports: {
        Row: {
          counts: Json
          created_at: string
          finished_at: string | null
          id: string
          proof: Json
          source: string
          source_label: string
          status: string
          store_id: string
        }
        Insert: {
          counts?: Json
          created_at?: string
          finished_at?: string | null
          id?: string
          proof?: Json
          source: string
          source_label: string
          status?: string
          store_id: string
        }
        Update: {
          counts?: Json
          created_at?: string
          finished_at?: string | null
          id?: string
          proof?: Json
          source?: string
          source_label?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_imports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_integrations: {
        Row: {
          config: Json
          enabled: boolean
          kind: string
          provider: string
          secret_enc: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          kind: string
          provider: string
          secret_enc?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          kind?: string
          provider?: string
          secret_enc?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          content: Json
          edited: boolean
          kind: string
          store_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          edited?: boolean
          kind: string
          store_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          edited?: boolean
          kind?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          brand_color: string | null
          business_type: string | null
          cart_reminders: boolean
          company_address: string | null
          country: string
          created_at: string
          currency_base: string
          first_opened_at: string | null
          gstin: string | null
          id: string
          invoice_footer: string | null
          invoice_name: string | null
          invoice_prefix: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string
          pan: string | null
          refund_days: number
          revenue_goal_minor: number | null
          sells: string
          setup_mode: string
          shipping: Json
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          support_email: string | null
          tagline: string | null
          theme: Json
          theme_mode: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_color?: string | null
          business_type?: string | null
          cart_reminders?: boolean
          company_address?: string | null
          country?: string
          created_at?: string
          currency_base?: string
          first_opened_at?: string | null
          gstin?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_name?: string | null
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          pan?: string | null
          refund_days?: number
          revenue_goal_minor?: number | null
          sells?: string
          setup_mode?: string
          shipping?: Json
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_color?: string | null
          business_type?: string | null
          cart_reminders?: boolean
          company_address?: string | null
          country?: string
          created_at?: string
          currency_base?: string
          first_opened_at?: string | null
          gstin?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_name?: string | null
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          pan?: string | null
          refund_days?: number
          revenue_goal_minor?: number | null
          sells?: string
          setup_mode?: string
          shipping?: Json
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          kind: string
          rate_bps: number
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          kind: string
          rate_bps: number
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          rate_bps?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          gateway: string
          id: number
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          gateway: string
          id?: never
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          gateway?: string
          id?: never
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          areas: string[]
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          status: string
          token_hash: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          areas?: string[]
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          areas?: string[]
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_credit_balances: {
        Row: {
          balance: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_credit_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_balances: {
        Row: {
          available_minor: number | null
          currency: string | null
          pending_minor: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_customers: {
        Row: {
          buyer_country: string | null
          buyer_email: string | null
          buyer_name: string | null
          currency: string | null
          first_order_at: string | null
          last_order_at: string | null
          orders_count: number | null
          store_id: string | null
          total_spent_minor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_orders: {
        Row: {
          available_at: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_state: string | null
          cod_fee_minor: number | null
          created_at: string | null
          currency: string | null
          deals_applied: Json | null
          delivered_at: string | null
          discount_minor: number | null
          fulfilment_status: string | null
          id: string | null
          invoice_no: string | null
          paid_at: string | null
          payment_method: string | null
          ref: string | null
          ship_to: Json | null
          shipped_at: string | null
          shipping_minor: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          store_id: string | null
          subtotal_minor: number | null
          tax_minor: number | null
          total_minor: number | null
          tracking: Json | null
        }
        Insert: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_state?: string | null
          cod_fee_minor?: number | null
          created_at?: string | null
          currency?: string | null
          deals_applied?: Json | null
          delivered_at?: string | null
          discount_minor?: number | null
          fulfilment_status?: string | null
          id?: string | null
          invoice_no?: string | null
          paid_at?: string | null
          payment_method?: string | null
          ref?: string | null
          ship_to?: Json | null
          shipped_at?: string | null
          shipping_minor?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id?: string | null
          subtotal_minor?: number | null
          tax_minor?: number | null
          total_minor?: number | null
          tracking?: Json | null
        }
        Update: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_state?: string | null
          cod_fee_minor?: number | null
          created_at?: string | null
          currency?: string | null
          deals_applied?: Json | null
          delivered_at?: string | null
          discount_minor?: number | null
          fulfilment_status?: string | null
          id?: string | null
          invoice_no?: string | null
          paid_at?: string | null
          payment_method?: string | null
          ref?: string | null
          ship_to?: Json | null
          shipped_at?: string | null
          shipping_minor?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id?: string | null
          subtotal_minor?: number | null
          tax_minor?: number | null
          total_minor?: number | null
          tracking?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_product_sales: {
        Row: {
          currency: string | null
          product_id: string | null
          revenue_minor: number | null
          store_id: string | null
          title: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          asker_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          product_id: string | null
          product_title: string | null
          status: Database["public"]["Enums"]["moderation_status"] | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_reviews: {
        Row: {
          body: string | null
          created_at: string | null
          creator_reply: string | null
          id: string | null
          photos: string[] | null
          pinned: boolean | null
          product_id: string | null
          product_title: string | null
          rating: number | null
          replied_at: string | null
          reviewer_name: string | null
          status: Database["public"]["Enums"]["moderation_status"] | null
          store_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_sales_daily: {
        Row: {
          currency: string | null
          day: string | null
          discount_minor: number | null
          gross_minor: number | null
          net_minor: number | null
          orders_count: number | null
          store_id: string | null
          tax_minor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ratings: {
        Row: {
          avg_rating: number | null
          product_id: string | null
          r1: number | null
          r2: number | null
          r3: number | null
          r4: number | null
          r5: number | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      actor_name: { Args: never; Returns: string }
      add_order_note: {
        Args: { p_body: string; p_order: string }
        Returns: Json
      }
      admin_audit: {
        Args: { p_limit?: number; p_q?: string }
        Returns: {
          action: string
          actor_email: string
          created_at: string
          id: number
          meta: Json
          target_id: string
          target_type: string
        }[]
      }
      admin_blog_delete: { Args: { p_id: string }; Returns: undefined }
      admin_blog_list: {
        Args: never
        Returns: {
          author: string
          body: string
          cover_alt: string
          cover_kind: string
          cover_src: string
          created_at: string
          excerpt: string
          id: string
          published_at: string
          slug: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      admin_blog_save: {
        Args: {
          p_author: string
          p_body: string
          p_cover_alt: string
          p_cover_kind: string
          p_cover_src: string
          p_excerpt: string
          p_id: string
          p_published_at: string
          p_slug: string
          p_status: string
          p_title: string
        }
        Returns: string
      }
      admin_content: {
        Args: { p_status?: string; p_type: string }
        Returns: {
          answer: string
          author: string
          body: string
          created_at: string
          id: string
          kind: string
          open_reports: number
          product_title: string
          rating: number
          status: string
          store_id: string
          store_name: string
          title: string
        }[]
      }
      admin_counts: { Args: never; Returns: Json }
      admin_creators: {
        Args: { p_limit?: number; p_q?: string }
        Returns: {
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string
          orders: number
          plan: string
          revenue: Json
          stores: number
          suspended: number
        }[]
      }
      admin_deals: {
        Args: never
        Returns: {
          billing: string
          created_at: string
          currency: string
          ends_at: string
          id: string
          original_price_minor: number
          price_minor: number
          status: string
          store_id: string
          store_name: string
          title: string
          verified_at: string
        }[]
      }
      admin_disputes: {
        Args: { p_status?: string }
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          gateway_dispute_id: string
          id: string
          order_id: string
          order_ref: string
          reason: string
          respond_by: string
          status: string
          store_name: string
        }[]
      }
      admin_live: { Args: never; Returns: Json }
      admin_moderate: {
        Args: {
          p_hide: boolean
          p_id: string
          p_reason?: string
          p_type: string
        }
        Returns: undefined
      }
      admin_orders: {
        Args: { p_limit?: number; p_q?: string; p_status?: string }
        Returns: {
          buyer_email: string
          buyer_name: string
          country: string
          created_at: string
          currency: string
          disputed: boolean
          id: string
          paid_at: string
          ref: string
          refunded: boolean
          status: string
          store_id: string
          store_name: string
          total_minor: number
        }[]
      }
      admin_overview: { Args: { p_days?: number }; Returns: Json }
      admin_payouts: {
        Args: { p_status?: string }
        Returns: {
          amount_minor: number
          currency: string
          failure_reason: string
          fee_minor: number
          fx_rate: number
          gateway_payout_id: string
          has_fund_account: boolean
          holder_name: string
          id: string
          method_kind: string
          method_label: string
          owner_email: string
          payout_amount_minor: number
          payout_currency: string
          processed_at: string
          requested_at: string
          status: string
          store_country: string
          store_id: string
          store_name: string
        }[]
      }
      admin_products: {
        Args: { p_q?: string; p_status?: string; p_store?: string }
        Returns: {
          created_at: string
          currency: string
          fulfilment: string
          id: string
          price_minor: number
          product_type: string
          revenue: number
          slug: string
          status: string
          store_id: string
          store_name: string
          store_slug: string
          store_status: string
          title: string
          units: number
        }[]
      }
      admin_refunds: {
        Args: never
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          gateway_refund_id: string
          id: string
          order_id: string
          order_ref: string
          reason: string
          status: string
          store_name: string
        }[]
      }
      admin_reports: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          excerpt: string
          id: string
          label: string
          reason: string
          reporter_email: string
          resolved_at: string
          status: string
          store_id: string
          store_name: string
          target_id: string
          target_type: string
        }[]
      }
      admin_resolve_report: {
        Args: { p_remove: boolean; p_report: string }
        Returns: undefined
      }
      admin_reveal_buyer_phone: {
        Args: { p_order: string; p_reason: string }
        Returns: string
      }
      admin_search: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          id: string
          kind: string
          label: string
          sublabel: string
        }[]
      }
      admin_set_payout: {
        Args: {
          p_action: string
          p_payout: string
          p_reason?: string
          p_ref?: string
        }
        Returns: undefined
      }
      admin_set_product_status: {
        Args: { p_product: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      admin_set_store_status: {
        Args: { p_reason?: string; p_store: string; p_suspend: boolean }
        Returns: string
      }
      admin_stores: {
        Args: { p_limit?: number; p_q?: string }
        Returns: {
          country: string
          created_at: string
          currency: string
          domain: string
          gross: number
          id: string
          name: string
          orders: number
          owner_email: string
          owner_id: string
          owner_name: string
          products: number
          slug: string
          status: string
        }[]
      }
      admin_team: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          since: string
        }[]
      }
      admin_verify_deal: {
        Args: { p_deal: string; p_on: boolean }
        Returns: undefined
      }
      admin_webhooks: {
        Args: { p_failed?: boolean }
        Returns: {
          created_at: string
          error: string
          event_id: string
          event_type: string
          gateway: string
          id: number
          processed_at: string
        }[]
      }
      agent_charge_credits: {
        Args: {
          p_agent: string
          p_key: string
          p_n: number
          p_reason: string
          p_store: string
        }
        Returns: string
      }
      agent_claim_job: {
        Args: { p_id: string; p_lease_seconds: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          instance_id: string | null
          kind: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          payload: Json
          run_at: string
          run_id: string | null
          status: string
          store_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      agent_claim_jobs: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          instance_id: string | null
          kind: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          payload: Json
          run_at: string
          run_id: string | null
          status: string
          store_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      agent_credit_balance: { Args: { p_store: string }; Returns: number }
      agent_finish_job: {
        Args: {
          p_error?: string
          p_id: string
          p_ok: boolean
          p_retry_seconds?: number
        }
        Returns: string
      }
      agent_grant_credits: {
        Args: {
          p_agent: string
          p_by?: string
          p_key: string
          p_kind: string
          p_n: number
          p_reason?: string
          p_store: string
        }
        Returns: boolean
      }
      agent_outbox_finish: {
        Args: {
          p_error?: string
          p_id: string
          p_provider_id?: string
          p_status: string
        }
        Returns: undefined
      }
      agent_outbox_reserve: {
        Args: {
          p_agent: string
          p_body: string
          p_cap_days: number
          p_cap_messages: number
          p_channel: string
          p_contact_key: string
          p_credits: number
          p_daily_cap: number
          p_instance: string
          p_key: string
          p_reason: string
          p_store: string
          p_subject: string
          p_to: string
        }
        Returns: {
          outbox_id: string
          outbox_status: string
          result: string
        }[]
      }
      agent_request_demand: {
        Args: {
          p_agent: string
          p_email: string
          p_mobile?: string
          p_note?: string
          p_store?: string
        }
        Returns: undefined
      }
      ai_credits_remaining: { Args: never; Returns: number }
      ai_page_allowance: {
        Args: never
        Returns: {
          daily: number
          used: number
        }[]
      }
      ai_pages_used_today: { Args: { p_owner: string }; Returns: number }
      analytics_visits: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      apply_direct_payment: {
        Args: { p_gateway_order_id: string; p_gateway_payment_id: string }
        Returns: {
          out_already_paid: boolean
          out_order_id: string
          out_ref: string
          out_token: string
        }[]
      }
      apply_partial_refund: {
        Args: {
          p_amount: number
          p_gateway_refund_id: string
          p_order: string
          p_reason: string
        }
        Returns: undefined
      }
      apply_payment: {
        Args: {
          p_gateway_fee_minor?: number
          p_gateway_order_id: string
          p_gateway_payment_id: string
        }
        Returns: {
          out_already_paid: boolean
          out_order_id: string
          out_ref: string
          out_token: string
        }[]
      }
      apply_refund: {
        Args: { p_gateway_refund_id: string; p_order: string; p_reason: string }
        Returns: undefined
      }
      ask_question: {
        Args: {
          p_body: string
          p_email: string
          p_name: string
          p_product: string
          p_store_slug: string
        }
        Returns: Json
      }
      auth_methods: {
        Args: { p_email: string }
        Returns: {
          out_exists: boolean
          out_google: boolean
          out_password: boolean
        }[]
      }
      booked_slots: {
        Args: {
          p_from: string
          p_page_slug: string
          p_store_slug: string
          p_to: string
        }
        Returns: {
          slot_at: string
          slot_minutes: number
        }[]
      }
      claim_download: {
        Args: { p_file: string; p_token: string }
        Returns: {
          file_name: string
          mime_type: string
          storage_path: string
        }[]
      }
      create_order: {
        Args: {
          p_buyer_state?: string
          p_cod_fee?: number
          p_country: string
          p_coupon: string
          p_currency: string
          p_deals: Json
          p_discount: number
          p_email: string
          p_gateway_order_id: string
          p_items: Json
          p_name: string
          p_payment_method?: string
          p_phone: string
          p_ref: string
          p_ship_to?: Json
          p_shipping?: number
          p_store: string
          p_subtotal: number
          p_tax: number
          p_total: number
        }
        Returns: string
      }
      creator_order_views: { Args: { p_orders: string[] }; Returns: Json }
      customer_audience: {
        Args: { p_store: string }
        Returns: {
          email: string
          opted_in: boolean
          unsubscribed: boolean
        }[]
      }
      finish_ai_page: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      gen_order_ref: { Args: never; Returns: string }
      get_order: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_product_owner: { Args: { p_product: string }; Returns: boolean }
      is_store_owner: { Args: { p_store: string }; Returns: boolean }
      issue_download_token: { Args: { p_order: string }; Returns: string }
      lookup_order: {
        Args: { p_email: string; p_ref: string }
        Returns: string
      }
      marketplace_deals: {
        Args: {
          p_badge?: string
          p_billing?: string
          p_country?: string
          p_fulfilment?: string
          p_kind?: string
          p_limit?: number
          p_max_minor?: number
          p_min_minor?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
        }
        Returns: {
          billing: string
          billing_interval: string
          cover_bg: string
          cover_url: string
          created_at: string
          currency: string
          deal_id: string
          ends_at: string
          fulfilment: string
          kind: string
          original_minor: number
          pitch: string
          price_minor: number
          product_slug: string
          rating: number
          revenue_30d_minor: number
          revenue_minor: number
          reviews: number
          store_country: string
          store_name: string
          store_slug: string
          title: string
          trusted: boolean
          units: number
          verified: boolean
        }[]
      }
      money_text: {
        Args: { p_currency: string; p_minor: number }
        Returns: string
      }
      my_stores: {
        Args: never
        Returns: {
          areas: string[]
          brand_color: string
          created_at: string
          id: string
          name: string
          owner_plan: string
          role: string
          slug: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      my_workspaces: {
        Args: never
        Returns: {
          areas: string[]
          created_at: string
          id: string
          name: string
          owner_plan: string
          role: string
          stores: number
        }[]
      }
      next_invoice_no: { Args: never; Returns: string }
      notification_visible: {
        Args: { p_area: string; p_store: string }
        Returns: boolean
      }
      notifications_read_all: { Args: { p_store: string }; Returns: undefined }
      notify: {
        Args: {
          p_area: string
          p_body: string
          p_dedupe: string
          p_href: string
          p_kind: string
          p_store: string
          p_title: string
        }
        Returns: undefined
      }
      order_for_token: { Args: { p_token: string }; Returns: string }
      order_refunded: { Args: { p_order: string }; Returns: number }
      order_view: { Args: { p_order: string }; Returns: Json }
      other_kind_live: {
        Args: { p_except: string; p_kind: string; p_store: string }
        Returns: string
      }
      payout_name_tokens: { Args: { p: string }; Returns: string[] }
      primary_domain: { Args: { p_slug: string }; Returns: string }
      product_is_public: { Args: { p_product: string }; Returns: boolean }
      product_stats: {
        Args: { p_from: string; p_product: string; p_to: string }
        Returns: Json
      }
      record_dispute: {
        Args: {
          p_amount: number
          p_currency: string
          p_dispute_id: string
          p_payment_id: string
          p_reason: string
          p_respond_by: string
          p_status: string
        }
        Returns: undefined
      }
      report_content: {
        Args: {
          p_email?: string
          p_reason: string
          p_target: string
          p_type: string
        }
        Returns: undefined
      }
      request_payout: {
        Args: { p_amount: number; p_method: string; p_store: string }
        Returns: string
      }
      resolve_domain: { Args: { p_host: string }; Returns: string }
      return_stock: { Args: { p_order: string }; Returns: undefined }
      run_product_schedule: { Args: never; Returns: Json }
      set_order_fulfilment: {
        Args: {
          p_carrier?: string
          p_number?: string
          p_order: string
          p_status: string
          p_url?: string
        }
        Returns: undefined
      }
      settle_cod: { Args: { p_order: string }; Returns: undefined }
      settle_payout: {
        Args: {
          p_gateway_id?: string
          p_ok: boolean
          p_payout: string
          p_reason?: string
        }
        Returns: undefined
      }
      settle_payout_by_gateway: {
        Args: { p_gateway_id: string; p_ok: boolean; p_reason?: string }
        Returns: undefined
      }
      start_ai_page: {
        Args: { p_prompt: string; p_store: string }
        Returns: string
      }
      storage_store_id: { Args: { p_name: string }; Returns: string }
      store_can: {
        Args: { p_area?: string; p_store: string }
        Returns: boolean
      }
      store_can_files: {
        Args: { p_bucket: string; p_store: string }
        Returns: boolean
      }
      store_claim_accept: { Args: { p_token: string }; Returns: string }
      store_claim_blocker: { Args: { p_store: string }; Returns: string }
      store_claim_cancel: { Args: { p_claim: string }; Returns: undefined }
      store_claim_create: {
        Args: {
          p_email: string
          p_keep_previous?: boolean
          p_note?: string
          p_store: string
        }
        Returns: Json
      }
      store_claim_info: { Args: { p_token: string }; Returns: Json }
      store_is_public: { Args: { p_store: string }; Returns: boolean }
      store_slug_available: { Args: { p_slug: string }; Returns: boolean }
      submit_lead: {
        Args: {
          p_data: Json
          p_email: string
          p_kind: string
          p_minutes?: number
          p_name: string
          p_page_slug: string
          p_phone: string
          p_slot?: string
          p_store_slug: string
        }
        Returns: undefined
      }
      submit_open_review: {
        Args: {
          p_body: string
          p_email: string
          p_name: string
          p_product: string
          p_rating: number
          p_store_slug: string
          p_title: string
        }
        Returns: boolean
      }
      submit_review: {
        Args: {
          p_body: string
          p_product: string
          p_rating: number
          p_title: string
          p_token: string
        }
        Returns: undefined
      }
      suggest_store_slug: { Args: { p_name: string }; Returns: string }
      switch_live_kind: {
        Args: { p_store: string; p_to: string }
        Returns: Json
      }
      take_stock: { Args: { p_order: string }; Returns: undefined }
      team_accept: { Args: { p_token: string }; Returns: string }
      team_invite: {
        Args: {
          p_areas: string[]
          p_email: string
          p_role: string
          p_workspace: string
        }
        Returns: Json
      }
      team_invite_info: { Args: { p_token: string }; Returns: Json }
      team_list: {
        Args: { p_workspace: string }
        Returns: {
          accepted_at: string
          areas: string[]
          email: string
          expires_at: string
          id: string
          invited_at: string
          is_you: boolean
          last_seen_at: string
          name: string
          role: string
          status: string
        }[]
      }
      team_remove: { Args: { p_member: string }; Returns: undefined }
      team_update: {
        Args: { p_areas: string[]; p_member: string; p_role: string }
        Returns: undefined
      }
      touch_activity: { Args: never; Returns: undefined }
      track_event: {
        Args: {
          p_kind: string
          p_path: string
          p_product: string
          p_session: string
          p_source: string
          p_store_slug: string
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: {
          p_code: string
          p_product?: string
          p_store: string
          p_subtotal: number
        }
        Returns: {
          out_coupon_id: string
          out_discount_minor: number
        }[]
      }
      workspace_can: {
        Args: { p_area?: string; p_workspace: string }
        Returns: boolean
      }
      workspace_credits: { Args: { p_workspace: string }; Returns: number }
    }
    Enums: {
      discount_kind: "percent" | "fixed"
      domain_status: "pending" | "verifying" | "active" | "failed"
      moderation_status: "published" | "hidden"
      order_status: "pending" | "cod" | "paid" | "failed" | "refunded"
      page_status: "draft" | "published"
      payout_status:
        | "requested"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      plan_tier: "free" | "pro"
      product_status: "draft" | "live" | "archived"
      reward_kind: "percent_off" | "free_product"
      store_status: "draft" | "published" | "suspended"
      www_mode: "none" | "www_to_apex" | "apex_to_www"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      discount_kind: ["percent", "fixed"],
      domain_status: ["pending", "verifying", "active", "failed"],
      moderation_status: ["published", "hidden"],
      order_status: ["pending", "cod", "paid", "failed", "refunded"],
      page_status: ["draft", "published"],
      payout_status: ["requested", "processing", "paid", "failed", "cancelled"],
      plan_tier: ["free", "pro"],
      product_status: ["draft", "live", "archived"],
      reward_kind: ["percent_off", "free_product"],
      store_status: ["draft", "published", "suspended"],
      www_mode: ["none", "www_to_apex", "apex_to_www"],
    },
  },
} as const
