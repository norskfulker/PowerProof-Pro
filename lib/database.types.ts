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
      deal_rules: {
        Row: {
          active: boolean
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
          paid_at: string | null
          payment_method: string
          ref: string
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
          paid_at?: string | null
          payment_method?: string
          ref?: string
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
          paid_at?: string | null
          payment_method?: string
          ref?: string
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
          min_price_minor: number
          options: Json
          price_minor: number
          product_type: string
          sku: string | null
          slug: string
          source_url: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number | null
          store_id: string
          tax_rate_bps: number
          title: string
          track_stock: boolean
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
          min_price_minor?: number
          options?: Json
          price_minor?: number
          product_type?: string
          sku?: string | null
          slug: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id: string
          tax_rate_bps?: number
          title: string
          track_stock?: boolean
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
          min_price_minor?: number
          options?: Json
          price_minor?: number
          product_type?: string
          sku?: string | null
          slug?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id?: string
          tax_rate_bps?: number
          title?: string
          track_stock?: boolean
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
      reviews: {
        Row: {
          body: string | null
          created_at: string
          creator_reply: string | null
          id: string
          order_id: string
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
        }
        Insert: {
          body?: string | null
          created_at?: string
          creator_reply?: string | null
          id?: string
          order_id: string
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
        }
        Update: {
          body?: string | null
          created_at?: string
          creator_reply?: string | null
          id?: string
          order_id?: string
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
      store_members: {
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
          store_id: string
          token_hash: string | null
          updated_at: string
          user_id: string | null
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
          store_id: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
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
          store_id?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          company_address: string | null
          country: string
          created_at: string
          currency_base: string
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
          shipping: Json
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          support_email: string | null
          tagline: string | null
          theme: Json
          theme_mode: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          business_type?: string | null
          company_address?: string | null
          country?: string
          created_at?: string
          currency_base?: string
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
          shipping?: Json
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          business_type?: string | null
          company_address?: string | null
          country?: string
          created_at?: string
          currency_base?: string
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
          shipping?: Json
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
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
        }[]
      }
      next_invoice_no: { Args: never; Returns: string }
      order_for_token: { Args: { p_token: string }; Returns: string }
      payout_name_tokens: { Args: { p: string }; Returns: string[] }
      primary_domain: { Args: { p_slug: string }; Returns: string }
      product_is_public: { Args: { p_product: string }; Returns: boolean }
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
      take_stock: { Args: { p_order: string }; Returns: undefined }
      team_accept: { Args: { p_token: string }; Returns: string }
      team_invite: {
        Args: {
          p_areas: string[]
          p_email: string
          p_role: string
          p_store: string
        }
        Returns: Json
      }
      team_invite_info: { Args: { p_token: string }; Returns: Json }
      team_list: {
        Args: { p_store: string }
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
