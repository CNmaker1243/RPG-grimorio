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
      campaign_members: {
        Row: {
          campaign_id: string
          can_create_characters: boolean
          id: string
          joined_at: string
          max_characters: number | null
          role: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Insert: {
          campaign_id: string
          can_create_characters?: boolean
          id?: string
          joined_at?: string
          max_characters?: number | null
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id: string
        }
        Update: {
          campaign_id?: string
          can_create_characters?: boolean
          id?: string
          joined_at?: string
          max_characters?: number | null
          role?: Database["public"]["Enums"]["campaign_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string
          id: string
          invite_code: string
          max_characters_per_player: number
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          invite_code?: string
          max_characters_per_player?: number
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invite_code?: string
          max_characters_per_player?: number
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          campaign_id: string
          created_at: string
          data: Json
          id: string
          name: string
          notes: string
          owner_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          data?: Json
          id?: string
          name: string
          notes?: string
          owner_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          data?: Json
          id?: string
          name?: string
          notes?: string
          owner_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          campaign_id: string
          character_id: string | null
          character_name: string
          created_at: string
          dice_groups: Json
          expression: string
          id: string
          label: string
          modifier: number
          results: number[]
          roll_mode: string
          roller_name: string
          success_data: Json | null
          total: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          character_name?: string
          created_at?: string
          dice_groups?: Json
          expression: string
          id?: string
          label?: string
          modifier?: number
          results: number[]
          roll_mode?: string
          roller_name?: string
          success_data?: Json | null
          total: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          character_name?: string
          created_at?: string
          dice_groups?: Json
          expression?: string
          id?: string
          label?: string
          modifier?: number
          results?: number[]
          roll_mode?: string
          roller_name?: string
          success_data?: Json | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      member_template_limits: {
        Row: {
          id: string
          max_characters: number
          member_id: string
          template_id: string
        }
        Insert: {
          id?: string
          max_characters?: number
          member_id: string
          template_id: string
        }
        Update: {
          id?: string
          max_characters?: number
          member_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_template_limits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "campaign_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_template_limits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      sheet_skills: {
        Row: {
          attribute_id: string
          description: string
          id: string
          max_level: number
          name: string
          template_id: string
        }
        Insert: {
          attribute_id: string
          description?: string
          id?: string
          max_level?: number
          name: string
          template_id: string
        }
        Update: {
          attribute_id?: string
          description?: string
          id?: string
          max_level?: number
          name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_skills_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_templates: {
        Row: {
          campaign_id: string
          created_at: string
          fields: Json
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          fields?: Json
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          fields?: Json
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      success_tests: {
        Row: {
          campaign_id: string
          difficulty: number
          id: string
          name: string
          skill_id: string
        }
        Insert: {
          campaign_id: string
          difficulty?: number
          id?: string
          name: string
          skill_id: string
        }
        Update: {
          campaign_id?: string
          difficulty?: number
          id?: string
          name?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_tests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_tests_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "sheet_skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_member: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      is_mestra: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      join_campaign: { Args: { _code: string }; Returns: string }
      regenerate_invite: { Args: { _campaign: string }; Returns: string }
      roll_dice: {
        Args: {
          _campaign: string
          _count: number
          _label?: string
          _modifier?: number
          _sides: number
        }
        Returns: {
          campaign_id: string
          character_id: string | null
          character_name: string
          created_at: string
          dice_groups: Json
          expression: string
          id: string
          label: string
          modifier: number
          results: number[]
          roll_mode: string
          roller_name: string
          success_data: Json | null
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dice_rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_dice_combined: {
        Args: {
          _campaign: string
          _character?: string
          _dice: Json
          _label?: string
          _mode?: string
          _modifier?: number
        }
        Returns: {
          campaign_id: string
          character_id: string | null
          character_name: string
          created_at: string
          dice_groups: Json
          expression: string
          id: string
          label: string
          modifier: number
          results: number[]
          roll_mode: string
          roller_name: string
          success_data: Json | null
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dice_rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_success_test: {
        Args: { _character: string; _test: string }
        Returns: {
          campaign_id: string
          character_id: string | null
          character_name: string
          created_at: string
          dice_groups: Json
          expression: string
          id: string
          label: string
          modifier: number
          results: number[]
          roll_mode: string
          roller_name: string
          success_data: Json | null
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dice_rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_campaign: { Args: { _a: string; _b: string }; Returns: boolean }
      validate_sheet_values: {
        Args: { _data: Json; _template: string }
        Returns: undefined
      }
    }
    Enums: {
      campaign_role: "mestra" | "jogador"
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
      campaign_role: ["mestra", "jogador"],
    },
  },
} as const
