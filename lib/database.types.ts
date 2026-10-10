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
        Relationships: []
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
            referencedRelation: "orders"
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
      order_items: {
        Row: {
          discount_minor: number
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
          fulfilment: string
        }
        Insert: {
          discount_minor?: number
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
          fulfilment?: string
        }
        Update: {
          discount_minor?: number
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
          fulfilment?: string
        }
        Relationships: [
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
        ]
      }
      orders: {
        Row: {
          available_at: string | null
          buyer_country: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          consent_at: string
          coupon_id: string | null
          created_at: string
          currency: string
          deals_applied: Json
          discount_minor: number
          gateway: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          invoice_no: string | null
          invoice_path: string | null
          paid_at: string | null
          ref: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          payment_method: string
          shipping_minor: number
          cod_fee_minor: number
          ship_to: Json | null
          fulfilment_status: string | null
          tracking: Json | null
          shipped_at: string | null
          delivered_at: string | null
          stock_taken: boolean
        }
        Insert: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          consent_at: string
          coupon_id?: string | null
          created_at?: string
          currency: string
          deals_applied?: Json
          discount_minor?: number
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          invoice_no?: string | null
          invoice_path?: string | null
          paid_at?: string | null
          ref?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal_minor: number
          tax_minor?: number
          total_minor: number
          updated_at?: string
          payment_method?: string
          shipping_minor?: number
          cod_fee_minor?: number
          ship_to?: Json | null
          fulfilment_status?: string | null
          tracking?: Json | null
          shipped_at?: string | null
          delivered_at?: string | null
          stock_taken?: boolean
        }
        Update: {
          available_at?: string | null
          buyer_country?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string
          consent_at?: string
          coupon_id?: string | null
          created_at?: string
          currency?: string
          deals_applied?: Json
          discount_minor?: number
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          invoice_no?: string | null
          invoice_path?: string | null
          paid_at?: string | null
          ref?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          payment_method?: string
          shipping_minor?: number
          cod_fee_minor?: number
          ship_to?: Json | null
          fulfilment_status?: string | null
          tracking?: Json | null
          shipped_at?: string | null
          delivered_at?: string | null
          stock_taken?: boolean
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
          asset: string | null
          network: string | null
          wallet_address: string | null
          account_last4: string | null
          bank_name: string | null
          created_at: string
          gateway_fund_account_id: string | null
          holder_name: string
          id: string
          ifsc: string | null
          is_default: boolean
          kind: string
          owner_id: string
          updated_at: string
          upi_masked: string | null
          verified_at: string | null
        }
        Insert: {
          asset?: string | null
          network?: string | null
          wallet_address?: string | null
          account_last4?: string | null
          bank_name?: string | null
          created_at?: string
          gateway_fund_account_id?: string | null
          holder_name: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          kind: string
          owner_id: string
          updated_at?: string
          upi_masked?: string | null
          verified_at?: string | null
        }
        Update: {
          asset?: string | null
          network?: string | null
          wallet_address?: string | null
          account_last4?: string | null
          bank_name?: string | null
          created_at?: string
          gateway_fund_account_id?: string | null
          holder_name?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          kind?: string
          owner_id?: string
          updated_at?: string
          upi_masked?: string | null
          verified_at?: string | null
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
          gateway_payout_id: string | null
          id: string
          method_id: string
          owner_id: string
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
          gateway_payout_id?: string | null
          id?: string
          method_id: string
          owner_id: string
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
          gateway_payout_id?: string | null
          id?: string
          method_id?: string
          owner_id?: string
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
      fx_rates: {
        Row: { currency: string; per_usd: number; updated_at: string }
        Insert: { currency: string; per_usd: number; updated_at?: string }
        Update: { currency?: string; per_usd?: number; updated_at?: string }
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
        Insert: never
        Update: never
        Relationships: []
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
          ends_at?: string | null
          original_price_minor: number
          pitch: string
          price_minor: number
          product_id: string
          show_revenue?: boolean
          status?: string
          store_id: string
          title: string
        }
        Update: {
          billing?: string
          billing_interval?: string | null
          ends_at?: string | null
          original_price_minor?: number
          pitch?: string
          price_minor?: number
          show_revenue?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          max_pages: number | null
          ai_credits_monthly: number
          ai_pages_daily: number
          custom_domain: boolean
          max_products: number | null
          max_stores: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps: number
        }
        Insert: {
          max_pages?: number | null
          ai_credits_monthly: number
          ai_pages_daily?: number
          custom_domain?: boolean
          max_products?: number | null
          max_stores?: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps?: number
        }
        Update: {
          max_pages?: number | null
          ai_credits_monthly?: number
          custom_domain?: boolean
          max_products?: number | null
          max_stores?: number | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          platform_fee_bps?: number
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
          fulfilment: string
          compare_at_price_minor: number | null
          cover_bg: Json | null
          created_at: string
          currency: string
          description: string | null
          hsn_sac: string | null
          id: string
          min_price_minor: number
          price_minor: number
          product_type: string
          sku: string | null
          slug: string
          source_url: string | null
          status: Database["public"]["Enums"]["product_status"]
          store_id: string
          tax_rate_bps: number
          title: string
          updated_at: string
          options: Json
          track_stock: boolean
          stock: number | null
          weight_grams: number | null
        }
        Insert: {
          fulfilment?: string
          compare_at_price_minor?: number | null
          cover_bg?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          hsn_sac?: string | null
          id?: string
          min_price_minor?: number
          price_minor?: number
          product_type?: string
          sku?: string | null
          slug: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          store_id: string
          tax_rate_bps?: number
          title: string
          updated_at?: string
          options?: Json
          track_stock?: boolean
          stock?: number | null
          weight_grams?: number | null
        }
        Update: {
          fulfilment?: string
          compare_at_price_minor?: number | null
          cover_bg?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          hsn_sac?: string | null
          id?: string
          min_price_minor?: number
          price_minor?: number
          product_type?: string
          sku?: string | null
          slug?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          store_id?: string
          tax_rate_bps?: number
          title?: string
          updated_at?: string
          options?: Json
          track_stock?: boolean
          stock?: number | null
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
            referencedRelation: "orders"
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
          created_at: string
          country: string
          currency_base: string
          gstin: string | null
          id: string
          invoice_footer: string | null
          invoice_prefix: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string
          pan: string | null
          refund_days: number
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          support_email: string | null
          tagline: string | null
          theme: Json
          theme_mode: string
          updated_at: string
          shipping: Json
        }
        Insert: {
          brand_color?: string | null
          business_type?: string | null
          company_address?: string | null
          created_at?: string
          country?: string
          currency_base?: string
          gstin?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          pan?: string | null
          refund_days?: number
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
          shipping?: Json
        }
        Update: {
          brand_color?: string | null
          business_type?: string | null
          company_address?: string | null
          created_at?: string
          country?: string
          currency_base?: string
          gstin?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          pan?: string | null
          refund_days?: number
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          support_email?: string | null
          tagline?: string | null
          theme?: Json
          theme_mode?: string
          updated_at?: string
          shipping?: Json
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
      creator_orders: {
        Row: {
          id: string | null
          ref: string | null
          store_id: string | null
          buyer_name: string | null
          buyer_email: string | null
          buyer_country: string | null
          currency: string | null
          subtotal_minor: number | null
          discount_minor: number | null
          tax_minor: number | null
          total_minor: number | null
          deals_applied: Json | null
          status: string | null
          paid_at: string | null
          available_at: string | null
          invoice_no: string | null
          created_at: string | null
          payment_method: string | null
          shipping_minor: number | null
          cod_fee_minor: number | null
          ship_to: Json | null
          fulfilment_status: string | null
          tracking: Json | null
          shipped_at: string | null
          delivered_at: string | null
        }
        Relationships: []
      }
      creator_customers: {
        Row: {
          store_id: string | null
          buyer_email: string | null
          currency: string | null
          buyer_name: string | null
          buyer_country: string | null
          orders_count: number | null
          total_spent_minor: number | null
          first_order_at: string | null
          last_order_at: string | null
        }
        Relationships: []
      }
      creator_sales_daily: {
        Row: {
          store_id: string | null
          day: string | null
          currency: string | null
          orders_count: number | null
          gross_minor: number | null
          discount_minor: number | null
          tax_minor: number | null
          net_minor: number | null
        }
        Relationships: []
      }
      creator_product_sales: {
        Row: {
          store_id: string | null
          product_id: string | null
          title: string | null
          currency: string | null
          units: number | null
          revenue_minor: number | null
        }
        Relationships: []
      }
      creator_reviews: {
        Row: {
          id: string | null
          store_id: string | null
          product_id: string | null
          product_title: string | null
          reviewer_name: string | null
          rating: number | null
          title: string | null
          body: string | null
          photos: string[] | null
          status: string | null
          pinned: boolean | null
          creator_reply: string | null
          replied_at: string | null
          created_at: string | null
        }
        Relationships: []
      }
      creator_questions: {
        Row: {
          id: string | null
          store_id: string | null
          product_id: string | null
          product_title: string | null
          asker_name: string | null
          body: string | null
          answer: string | null
          answered_at: string | null
          status: string | null
          created_at: string | null
        }
        Relationships: []
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
      ai_credits_remaining: { Args: never; Returns: number }
      ai_page_allowance: { Args: never; Returns: { daily: number; used: number }[] }
      finish_ai_page: { Args: { p_id: string; p_status: string }; Returns: undefined }
      start_ai_page: { Args: { p_prompt: string; p_store: string }; Returns: string }
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
      booked_slots: {
        Args: { p_from: string; p_page_slug: string; p_store_slug: string; p_to: string }
        Returns: { slot_at: string; slot_minutes: number }[]
      }
      admin_verify_deal: { Args: { p_deal: string; p_on: boolean }; Returns: undefined }
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
          billing_interval: string | null
          cover_bg: string | null
          cover_url: string | null
          created_at: string
          currency: string
          deal_id: string
          ends_at: string | null
          fulfilment: string
          kind: string
          original_minor: number
          pitch: string
          price_minor: number
          product_slug: string
          rating: number | null
          revenue_30d_minor: number | null
          revenue_minor: number | null
          reviews: number
          store_country: string | null
          store_name: string
          store_slug: string
          title: string
          trusted: boolean
          units: number
          verified: boolean
        }[]
      }
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
      create_order: {
        Args: {
          p_country: string
          p_coupon: string
          p_currency: string
          p_deals: Json
          p_discount: number
          p_email: string
          p_gateway_order_id: string
          p_items: Json
          p_name: string
          p_phone: string
          p_ref: string
          p_store: string
          p_subtotal: number
          p_tax: number
          p_total: number
          p_payment_method?: string
          p_shipping?: number
          p_cod_fee?: number
          p_ship_to?: Json
        }
        Returns: string
      }
      set_order_fulfilment: { Args: { p_order: string; p_status: string; p_carrier?: string; p_number?: string; p_url?: string }; Returns: undefined }
      settle_cod: { Args: { p_order: string }; Returns: undefined }
      issue_download_token: { Args: { p_order: string }; Returns: string }
      order_for_token: { Args: { p_token: string }; Returns: string }
      claim_download: { Args: { p_file: string; p_token: string }; Returns: { file_name: string; mime_type: string | null; storage_path: string }[] }
      apply_refund: { Args: { p_gateway_refund_id: string; p_order: string; p_reason: string }; Returns: undefined }
      track_event: { Args: { p_kind: string; p_path: string; p_product: string; p_session: string; p_source: string; p_store_slug: string }; Returns: undefined }
      analytics_visits: { Args: { p_from: string; p_store: string; p_to: string }; Returns: Json }
      get_order: { Args: { p_token: string }; Returns: Json }
      lookup_order: { Args: { p_email: string; p_ref: string }; Returns: string }
      submit_review: { Args: { p_body: string; p_product: string; p_rating: number; p_title: string; p_token: string }; Returns: undefined }
      ask_question: { Args: { p_body: string; p_email: string; p_name: string; p_product: string; p_store_slug: string }; Returns: Json }
      gen_order_ref: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_product_owner: { Args: { p_product: string }; Returns: boolean }
      is_store_owner: { Args: { p_store: string }; Returns: boolean }
      next_invoice_no: { Args: never; Returns: string }
      store_slug_available: { Args: { p_slug: string }; Returns: boolean }
      suggest_store_slug: { Args: { p_name: string }; Returns: string }
      product_is_public: { Args: { p_product: string }; Returns: boolean }
      request_payout: {
        Args: { p_amount: number; p_method: string; p_store: string }
        Returns: string
      }
      resolve_domain: { Args: { p_host: string }; Returns: string }
      settle_payout: {
        Args: {
          p_gateway_id?: string
          p_ok: boolean
          p_payout: string
          p_reason?: string
        }
        Returns: undefined
      }
      storage_store_id: { Args: { p_name: string }; Returns: string }
      store_is_public: { Args: { p_store: string }; Returns: boolean }
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
