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
      dismissed_prompts: {
        Row: {
          dismissed_at: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          deposit_pct: number | null
          id: string
          is_active: boolean
          projected_target_date: string | null
          rough_target_date: string | null
          saved_amount: number
          target_amount: number
          target_region: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deposit_pct?: number | null
          id?: string
          is_active?: boolean
          projected_target_date?: string | null
          rough_target_date?: string | null
          saved_amount?: number
          target_amount: number
          target_region?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deposit_pct?: number | null
          id?: string
          is_active?: boolean
          projected_target_date?: string | null
          rough_target_date?: string | null
          saved_amount?: number
          target_amount?: number
          target_region?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ob_accounts: {
        Row: {
          account_type: string | null
          available_balance: number | null
          connection_id: string
          created_at: string
          currency: string | null
          current_balance: number | null
          display_name: string | null
          id: string
          provider_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          available_balance?: number | null
          connection_id: string
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          display_name?: string | null
          id?: string
          provider_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          available_balance?: number | null
          connection_id?: string
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          display_name?: string | null
          id?: string
          provider_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ob_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ob_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ob_connections: {
        Row: {
          created_at: string
          id: string
          institution_name: string | null
          last_synced_at: string | null
          provider_connection_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          provider_connection_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          provider_connection_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ob_tokens: {
        Row: {
          access_token: string
          connection_id: string | null
          created_at: string
          expires_at: string
          id: string
          provider: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connection_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          provider?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connection_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ob_tokens_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ob_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ob_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          merchant_name: string | null
          provider_transaction_id: string
          timestamp: string
          transaction_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          merchant_name?: string | null
          provider_transaction_id: string
          timestamp: string
          transaction_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          merchant_name?: string | null
          provider_transaction_id?: string
          timestamp?: string
          transaction_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ob_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ob_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_benchmarks: {
        Row: {
          age: number
          id: string
          salary_p25: number
          salary_p50: number
          salary_p75: number
          sector: string
          tier: string
        }
        Insert: {
          age: number
          id?: string
          salary_p25: number
          salary_p50: number
          salary_p75: number
          sector: string
          tier: string
        }
        Update: {
          age?: number
          id?: string
          salary_p25?: number
          salary_p50?: number
          salary_p75?: number
          sector?: string
          tier?: string
        }
        Relationships: []
      }
      trajectory_snapshots: {
        Row: {
          borrowing_score: number
          created_at: string
          goal_id: string
          growth_score: number
          id: string
          monthly_surplus: number
          saved_amount: number
          snapshot_date: string
          spending_score: number
          trajectory_age: number
          user_id: string
        }
        Insert: {
          borrowing_score: number
          created_at?: string
          goal_id: string
          growth_score: number
          id?: string
          monthly_surplus: number
          saved_amount: number
          snapshot_date: string
          spending_score: number
          trajectory_age: number
          user_id: string
        }
        Update: {
          borrowing_score?: number
          created_at?: string
          goal_id?: string
          growth_score?: number
          id?: string
          monthly_surplus?: number
          saved_amount?: number
          snapshot_date?: string
          spending_score?: number
          trajectory_age?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_snapshots_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          current_salary: number
          date_of_birth: string | null
          onboarding_complete: boolean
          onboarding_step: number
          sector: string
          trajectory_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_salary: number
          date_of_birth?: string | null
          onboarding_complete?: boolean
          onboarding_step?: number
          sector: string
          trajectory_tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_salary?: number
          date_of_birth?: string | null
          onboarding_complete?: boolean
          onboarding_step?: number
          sector?: string
          trajectory_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
