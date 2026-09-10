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
  public: {
    Tables: {
      appointments: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          data_consent: boolean | null
          data_consent_at: string | null
          ends_at: string
          id: string
          notes: string | null
          origin: string
          owner_id: string | null
          price_cents: number | null
          professional_id: string | null
          service_id: string | null
          signature_data_url: string | null
          signed_at: string | null
          signed_by_name: string | null
          starts_at: string
          status: string
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          data_consent?: boolean | null
          data_consent_at?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          origin?: string
          owner_id?: string | null
          price_cents?: number | null
          professional_id?: string | null
          service_id?: string | null
          signature_data_url?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          starts_at: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          data_consent?: boolean | null
          data_consent_at?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          origin?: string
          owner_id?: string | null
          price_cents?: number | null
          professional_id?: string | null
          service_id?: string | null
          signature_data_url?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          starts_at?: string
          status?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          destination: string
          id: string
          size_bytes: number
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          destination?: string
          id?: string
          size_bytes?: number
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string
          id?: string
          size_bytes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          kind: string
          professional_id: string | null
          reason: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          kind?: string
          professional_id?: string | null
          reason?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          kind?: string
          professional_id?: string | null
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          business_id: string
          close_time: string
          closed: boolean
          created_at: string
          id: string
          open_time: string
          professional_id: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          business_id: string
          close_time?: string
          closed?: boolean
          created_at?: string
          id?: string
          open_time?: string
          professional_id?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          business_id?: string
          close_time?: string
          closed?: boolean
          created_at?: string
          id?: string
          open_time?: string
          professional_id?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          address: string | null
          booking_phone: string | null
          business_name: string
          contact_phone: string | null
          created_at: string
          facebook: string | null
          instagram: string | null
          manager_name: string | null
          onboarded: boolean
          owner_name: string
          tiktok: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          booking_phone?: string | null
          business_name: string
          contact_phone?: string | null
          created_at?: string
          facebook?: string | null
          instagram?: string | null
          manager_name?: string | null
          onboarded?: boolean
          owner_name: string
          tiktok?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          booking_phone?: string | null
          business_name?: string
          contact_phone?: string | null
          created_at?: string
          facebook?: string | null
          instagram?: string | null
          manager_name?: string | null
          onboarded?: boolean
          owner_name?: string
          tiktok?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      businesses: {
        Row: {
          address: string | null
          booking_enabled: boolean
          business_type: string
          city: string | null
          country: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          onboarded: boolean
          onboarding_step: number
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          slug: string
          subscription_status: string
          timezone: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          booking_enabled?: boolean
          business_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name: string
          onboarded?: boolean
          onboarding_step?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          subscription_status?: string
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          booking_enabled?: boolean
          business_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          onboarded?: boolean
          onboarding_step?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          subscription_status?: string
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          business_id: string
          client_id: string
          created_at: string
          id: string
          private: boolean
        }
        Insert: {
          author_id?: string | null
          body: string
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          private?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          private?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birthdate: string | null
          business_id: string
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          id: string
          last_name: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          service_id: string | null
          service_price_cents: number | null
          source: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          birthdate?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          service_id?: string | null
          service_price_cents?: number | null
          source?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          birthdate?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          service_id?: string | null
          service_price_cents?: number | null
          source?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          business_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          method: string
          notes: string | null
          spent_at: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          business_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          method?: string
          notes?: string | null
          spent_at?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          method?: string
          notes?: string | null
          spent_at?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          business_id: string
          connected_at: string | null
          created_at: string
          id: string
          metadata: Json | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      package_sessions: {
        Row: {
          appointment_id: string | null
          business_id: string
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          package_id: string
          used_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id: string
          used_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          name: string
          price_cents: number
          service_id: string | null
          sessions_total: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          name: string
          price_cents?: number
          service_id?: string | null
          sessions_total?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
          service_id?: string | null
          sessions_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          bank: string | null
          business_id: string
          client_id: string | null
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          service_id: string | null
          status: string
          total_cents: number | null
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          appointment_id?: string | null
          bank?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          service_id?: string | null
          status?: string
          total_cents?: number | null
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          bank?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          service_id?: string | null
          status?: string
          total_cents?: number | null
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          features: Json
          max_appointments_per_month: number | null
          max_clients: number | null
          max_professionals: number | null
          max_services: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          price_cents: number
          updated_at: string
        }
        Insert: {
          features?: Json
          max_appointments_per_month?: number | null
          max_clients?: number | null
          max_professionals?: number | null
          max_services?: number | null
          plan: Database["public"]["Enums"]["plan_tier"]
          price_cents?: number
          updated_at?: string
        }
        Update: {
          features?: Json
          max_appointments_per_month?: number | null
          max_clients?: number | null
          max_professionals?: number | null
          max_services?: number | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      professional_services: {
        Row: {
          business_id: string
          created_at: string
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          business_id: string
          color: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          color?: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          color?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          business_id: string
          category: string | null
          color: string
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          owner_id: string | null
          price_cents: number
          professional_id: string | null
        }
        Insert: {
          active?: boolean
          business_id: string
          category?: string | null
          color?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name: string
          owner_id?: string | null
          price_cents?: number
          professional_id?: string | null
        }
        Update: {
          active?: boolean
          business_id?: string
          category?: string | null
          color?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          owner_id?: string | null
          price_cents?: number
          professional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          business_id: string
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          service_id: string | null
          sessions_total: number
          status: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          business_id: string
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          service_id?: string | null
          sessions_total?: number
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          service_id?: string | null
          sessions_total?: number
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_professional: { Args: { _id: string }; Returns: boolean }
      is_business_admin: { Args: { _business_id: string }; Returns: boolean }
      is_member: { Args: { _business_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "platform_admin" | "user"
      member_role: "owner" | "admin" | "staff"
      plan_tier: "free" | "pro"
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
      app_role: ["platform_admin", "user"],
      member_role: ["owner", "admin", "staff"],
      plan_tier: ["free", "pro"],
    },
  },
} as const
