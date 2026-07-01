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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          body: string
          branch_id: string | null
          category: string | null
          created_at: string
          estimated_value: number | null
          id: string
          is_dismissed: boolean
          title: string | null
        }
        Insert: {
          body: string
          branch_id?: string | null
          category?: string | null
          created_at?: string
          estimated_value?: number | null
          id?: string
          is_dismissed?: boolean
          title?: string | null
        }
        Update: {
          body?: string
          branch_id?: string | null
          category?: string | null
          created_at?: string
          estimated_value?: number | null
          id?: string
          is_dismissed?: boolean
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string
          duration_minutes: number
          id: string
          price: number
          service_id: string | null
          staff_id: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          price?: number
          service_id?: string | null
          staff_id?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          price?: number
          service_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          arrived_at: string | null
          booked_at: string
          branch_id: string | null
          cancelled_at: string | null
          client_id: string
          confirmed_at: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          source: Database["public"]["Enums"]["channel_type"] | null
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          booked_at?: string
          branch_id?: string | null
          cancelled_at?: string | null
          client_id: string
          confirmed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["channel_type"] | null
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          booked_at?: string
          branch_id?: string | null
          cancelled_at?: string | null
          client_id?: string
          confirmed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["channel_type"] | null
          staff_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_targets: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          period: string
          revenue_target: number
          target_date: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          period: string
          revenue_target?: number
          target_date: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          period?: string
          revenue_target?: number
          target_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_targets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          client_id: string
          converted: boolean
          created_at: string
          id: string
          responded: boolean
          sent_at: string | null
        }
        Insert: {
          campaign_id: string
          client_id: string
          converted?: boolean
          created_at?: string
          id?: string
          responded?: boolean
          sent_at?: string | null
        }
        Update: {
          campaign_id?: string
          client_id?: string
          converted?: boolean
          created_at?: string
          id?: string
          responded?: boolean
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_risks: {
        Row: {
          appointment_id: string
          client_id: string
          computed_at: string
          factors: Json | null
          id: string
          level: Database["public"]["Enums"]["risk_level"]
          recommended_action: string | null
          score: number
        }
        Insert: {
          appointment_id: string
          client_id: string
          computed_at?: string
          factors?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"]
          recommended_action?: string | null
          score?: number
        }
        Update: {
          appointment_id?: string
          client_id?: string
          computed_at?: string
          factors?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"]
          recommended_action?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_risks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_risks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_allergies: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          severity: string | null
          substance: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string | null
          substance: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string | null
          substance?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_allergies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_family_members: {
        Row: {
          client_id: string
          created_at: string
          full_name: string | null
          id: string
          related_client_id: string | null
          relationship: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          full_name?: string | null
          id?: string
          related_client_id?: string | null
          relationship?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          full_name?: string | null
          id?: string
          related_client_id?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_family_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_family_members_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          cancelled_at: string | null
          client_id: string
          created_at: string
          id: string
          plan_id: string
          renews_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          plan_id: string
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          plan_id?: string
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birthday: string | null
          branch_id: string | null
          created_at: string
          distance_km: number | null
          email: string | null
          full_name: string
          id: string
          marketing_opt_in: boolean
          phone: string | null
          preferences: string | null
          preferred_staff_id: string | null
          service_notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          branch_id?: string | null
          created_at?: string
          distance_km?: number | null
          email?: string | null
          full_name: string
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          preferences?: string | null
          preferred_staff_id?: string | null
          service_notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthday?: string | null
          branch_id?: string | null
          created_at?: string
          distance_km?: number | null
          email?: string | null
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          preferences?: string | null
          preferred_staff_id?: string | null
          service_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          client_id: string | null
          created_at: string
          external_id: string | null
          id: string
          is_bot_active: boolean
          last_message_at: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          client_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          client_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          appointment_id: string | null
          client_id: string
          created_at: string
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["deposit_status"]
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deposits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hair_history: {
        Row: {
          appointment_id: string | null
          client_id: string
          color_formula: string | null
          created_at: string
          id: string
          materials_used: string | null
          next_treatment_recommendation: string | null
          performed_on: string
          professional_notes: string | null
          service_id: string | null
          staff_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          color_formula?: string | null
          created_at?: string
          id?: string
          materials_used?: string | null
          next_treatment_recommendation?: string | null
          performed_on?: string
          professional_notes?: string | null
          service_id?: string | null
          staff_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          color_formula?: string | null
          created_at?: string
          id?: string
          materials_used?: string | null
          next_treatment_recommendation?: string | null
          performed_on?: string
          professional_notes?: string | null
          service_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hair_history_appointment_fk"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hair_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hair_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hair_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      hair_history_photos: {
        Row: {
          client_id: string
          created_at: string
          hair_history_id: string
          id: string
          kind: string | null
          storage_path: string
        }
        Insert: {
          client_id: string
          created_at?: string
          hair_history_id: string
          id?: string
          kind?: string | null
          storage_path: string
        }
        Update: {
          client_id?: string
          created_at?: string
          hair_history_id?: string
          id?: string
          kind?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "hair_history_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hair_history_photos_hair_history_id_fkey"
            columns: ["hair_history_id"]
            isOneToOne: false
            referencedRelation: "hair_history"
            referencedColumns: ["id"]
          },
        ]
      }
      hair_journey_predictions: {
        Row: {
          client_id: string
          created_at: string
          details: Json | null
          id: string
          predicted_date: string | null
          prediction_type: string
          resolved: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          details?: Json | null
          id?: string
          predicted_date?: string | null
          prediction_type: string
          resolved?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          predicted_date?: string | null
          prediction_type?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hair_journey_predictions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hair_simulations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          params: Json | null
          result_image_path: string | null
          simulation_type: string | null
          source_image_path: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          params?: Json | null
          result_image_path?: string | null
          simulation_type?: string | null
          source_image_path: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          params?: Json | null
          result_image_path?: string | null
          simulation_type?: string | null
          source_image_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "hair_simulations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          branch_id: string | null
          id: string
          product_id: string
          quantity: number
          reorder_level: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          id?: string
          product_id: string
          quantity?: number
          reorder_level?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reorder_level?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          appointment_id: string | null
          branch_id: string | null
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          appointment_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
        }
        Update: {
          appointment_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string | null
          id: string
          invoice_id: string
          line_total: number
          product_id: string | null
          quantity: number
          service_id: string | null
          unit_price: number
        }
        Insert: {
          description?: string | null
          id?: string
          invoice_id: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          unit_price?: number
        }
        Update: {
          description?: string | null
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          branch_id: string | null
          client_id: string
          created_at: string
          discount: number
          id: string
          issued_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          appointment_id?: string | null
          branch_id?: string | null
          client_id: string
          created_at?: string
          discount?: number
          id?: string
          issued_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          appointment_id?: string | null
          branch_id?: string | null
          client_id?: string
          created_at?: string
          discount?: number
          id?: string
          issued_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          branch_id: string | null
          converted_client_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["channel_type"]
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          branch_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["channel_type"]
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          branch_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["channel_type"]
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          lifetime_points: number
          points_balance: number
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          benefits: Json | null
          created_at: string
          id: string
          min_points: number
          name: Database["public"]["Enums"]["loyalty_tier_name"]
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          id?: string
          min_points?: number
          name: Database["public"]["Enums"]["loyalty_tier_name"]
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          id?: string
          min_points?: number
          name?: Database["public"]["Enums"]["loyalty_tier_name"]
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          account_id: string
          appointment_id: string | null
          created_at: string
          id: string
          points: number
          reason: string | null
          txn_type: Database["public"]["Enums"]["loyalty_txn_type"]
        }
        Insert: {
          account_id: string
          appointment_id?: string | null
          created_at?: string
          id?: string
          points: number
          reason?: string | null
          txn_type: Database["public"]["Enums"]["loyalty_txn_type"]
        }
        Update: {
          account_id?: string
          appointment_id?: string | null
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          txn_type?: Database["public"]["Enums"]["loyalty_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience_filter: Json | null
          branch_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          id: string
          message_template: string | null
          name: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
        }
        Insert: {
          audience_filter?: Json | null
          branch_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          message_template?: string | null
          name: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Update: {
          audience_filter?: Json | null
          branch_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          message_template?: string | null
          name?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          intent: string | null
          media_url: string | null
          sent_by_bot: boolean
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          intent?: string | null
          media_url?: string | null
          sent_by_bot?: boolean
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          intent?: string | null
          media_url?: string | null
          sent_by_bot?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          staff_id: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          staff_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          applies_to_tier:
            | Database["public"]["Enums"]["loyalty_tier_name"]
            | null
          branch_id: string | null
          created_at: string
          day_of_week: number | null
          end_time: string | null
          id: string
          is_active: boolean
          name: string
          service_id: string | null
          start_time: string | null
        }
        Insert: {
          adjustment_type?: string
          adjustment_value?: number
          applies_to_tier?:
            | Database["public"]["Enums"]["loyalty_tier_name"]
            | null
          branch_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name: string
          service_id?: string | null
          start_time?: string | null
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          applies_to_tier?:
            | Database["public"]["Enums"]["loyalty_tier_name"]
            | null
          branch_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
          service_id?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          id: string
          is_active: boolean
          is_retail: boolean
          name: string
          retail_price: number | null
          sku: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_retail?: boolean
          name: string
          retail_price?: number | null
          sku?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_retail?: boolean
          name?: string
          retail_price?: number | null
          sku?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity: number
          unit_cost?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          ordered_at: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string | null
          total: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string | null
          total?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string
          external_url: string | null
          id: string
          rating: number | null
          requested_at: string | null
          staff_id: string | null
          submitted_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          rating?: number | null
          requested_at?: string | null
          staff_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          rating?: number | null
          requested_at?: string | null
          staff_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      sales_opportunities: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string | null
          product_id: string | null
          status: string
          trigger_service_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          status?: string
          trigger_service_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          status?: string
          trigger_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_trigger_service_id_fkey"
            columns: ["trigger_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          deposit_amount: number | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          material_cost: number
          name: string
          requires_deposit: boolean
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          material_cost?: number
          name: string
          requires_deposit?: boolean
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          material_cost?: number
          name?: string
          requires_deposit?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          branch_id: string | null
          created_at: string
          handle: string | null
          id: string
          is_connected: boolean
          platform: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          access_token?: string | null
          branch_id?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          is_connected?: boolean
          platform: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          access_token?: string | null
          branch_id?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          is_connected?: boolean
          platform?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          auth_user_id: string | null
          branch_id: string | null
          commission_rate: number | null
          created_at: string
          email: string | null
          full_name: string
          hired_at: string | null
          hourly_cost: number | null
          id: string
          is_active: boolean
          phone: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          branch_id?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          hired_at?: string | null
          hourly_cost?: number | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          branch_id?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          hired_at?: string | null
          hourly_cost?: number | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_goals: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          product_sales_target: number | null
          revenue_target: number | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          product_sales_target?: number | null
          revenue_target?: number | null
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          product_sales_target?: number | null
          revenue_target?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_goals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          branch_id: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          staff_id: string
          starts_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          staff_id: string
          starts_at: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          approved: boolean
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          staff_id: string
          starts_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          staff_id: string
          starts_at: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          benefits: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_monthly: number
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_monthly?: number
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          branch_id: string | null
          client_id: string
          created_at: string
          desired_from: string | null
          desired_to: string | null
          id: string
          offered_appointment_id: string | null
          preferred_staff_id: string | null
          priority: number
          service_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
        }
        Insert: {
          branch_id?: string | null
          client_id: string
          created_at?: string
          desired_from?: string | null
          desired_to?: string | null
          id?: string
          offered_appointment_id?: string | null
          preferred_staff_id?: string | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
        }
        Update: {
          branch_id?: string | null
          client_id?: string
          created_at?: string
          desired_from?: string | null
          desired_to?: string | null
          id?: string
          offered_appointment_id?: string | null
          preferred_staff_id?: string | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offered_appointment_id_fkey"
            columns: ["offered_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "arrived"
        | "completed"
        | "cancelled"
        | "no_show"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "completed"
        | "cancelled"
      channel_type:
        | "whatsapp"
        | "sms"
        | "email"
        | "instagram"
        | "facebook"
        | "tiktok"
        | "google"
        | "website"
        | "phone"
        | "walk_in"
      deposit_status: "pending" | "paid" | "refunded" | "forfeited"
      invoice_status:
        | "draft"
        | "issued"
        | "paid"
        | "partially_paid"
        | "cancelled"
        | "refunded"
      lead_status: "new" | "contacted" | "scheduled" | "converted" | "lost"
      loyalty_tier_name: "silver" | "gold" | "platinum"
      loyalty_txn_type: "earn" | "redeem" | "expire" | "adjust"
      message_direction: "inbound" | "outbound"
      movement_type:
        | "purchase"
        | "consumption"
        | "adjustment"
        | "return"
        | "waste"
      payment_method:
        | "cash"
        | "card"
        | "bit"
        | "bank_transfer"
        | "subscription"
        | "other"
      po_status: "draft" | "ordered" | "received" | "cancelled"
      risk_level: "low" | "medium" | "high"
      subscription_status: "active" | "paused" | "cancelled" | "expired"
      waitlist_status:
        | "waiting"
        | "offered"
        | "accepted"
        | "expired"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "arrived",
        "completed",
        "cancelled",
        "no_show",
      ],
      campaign_status: [
        "draft",
        "scheduled",
        "running",
        "completed",
        "cancelled",
      ],
      channel_type: [
        "whatsapp",
        "sms",
        "email",
        "instagram",
        "facebook",
        "tiktok",
        "google",
        "website",
        "phone",
        "walk_in",
      ],
      deposit_status: ["pending", "paid", "refunded", "forfeited"],
      invoice_status: [
        "draft",
        "issued",
        "paid",
        "partially_paid",
        "cancelled",
        "refunded",
      ],
      lead_status: ["new", "contacted", "scheduled", "converted", "lost"],
      loyalty_tier_name: ["silver", "gold", "platinum"],
      loyalty_txn_type: ["earn", "redeem", "expire", "adjust"],
      message_direction: ["inbound", "outbound"],
      movement_type: [
        "purchase",
        "consumption",
        "adjustment",
        "return",
        "waste",
      ],
      payment_method: [
        "cash",
        "card",
        "bit",
        "bank_transfer",
        "subscription",
        "other",
      ],
      po_status: ["draft", "ordered", "received", "cancelled"],
      risk_level: ["low", "medium", "high"],
      subscription_status: ["active", "paused", "cancelled", "expired"],
      waitlist_status: [
        "waiting",
        "offered",
        "accepted",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
