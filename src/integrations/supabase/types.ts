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
      assignment_status_records: {
        Row: {
          assignment_id: string
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_status_records_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          teacher_id: string
          title: string
          unit_tag: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          teacher_id: string
          title: string
          unit_tag?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          teacher_id?: string
          title?: string
          unit_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_group_members: {
        Row: {
          added_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      message_groups: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          broadcast_id: string | null
          class_id: string
          created_at: string
          group_id: string | null
          id: string
          is_broadcast: boolean
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          broadcast_id?: string | null
          class_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          broadcast_id?: string | null
          class_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_items: string[]
          created_at: string
          full_name: string | null
          id: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_items?: string[]
          created_at?: string
          full_name?: string | null
          id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_items?: string[]
          created_at?: string
          full_name?: string | null
          id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          currency: Database["public"]["Enums"]["purchase_currency"]
          description: string
          emoji: string
          item_key: string
          item_name: string
          kind: Database["public"]["Enums"]["purchase_kind"]
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          currency: Database["public"]["Enums"]["purchase_currency"]
          description?: string
          emoji?: string
          item_key: string
          item_name: string
          kind: Database["public"]["Enums"]["purchase_kind"]
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["purchase_currency"]
          description?: string
          emoji?: string
          item_key?: string
          item_name?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
        }
        Relationships: []
      }
      shop_purchases: {
        Row: {
          class_id: string | null
          cost: number
          created_at: string
          currency: Database["public"]["Enums"]["purchase_currency"]
          id: string
          item_key: string
          item_name: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          student_id: string
        }
        Insert: {
          class_id?: string | null
          cost: number
          created_at?: string
          currency: Database["public"]["Enums"]["purchase_currency"]
          id?: string
          item_key: string
          item_name: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          student_id: string
        }
        Update: {
          class_id?: string | null
          cost?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["purchase_currency"]
          id?: string
          item_key?: string
          item_name?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          student_id?: string
        }
        Relationships: []
      }
      student_coins: {
        Row: {
          crown_coins: number
          star_coins: number
          student_id: string
          updated_at: string
        }
        Insert: {
          crown_coins?: number
          star_coins?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          crown_coins?: number
          star_coins?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          file_path: string | null
          id: string
          link_url: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          file_path?: string | null
          id?: string
          link_url?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          file_path?: string | null
          id?: string
          link_url?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_crowns: {
        Row: {
          awarded_at: string
          class_id: string
          id: string
          student_id: string
          unit_tag: string
        }
        Insert: {
          awarded_at?: string
          class_id: string
          id?: string
          student_id: string
          unit_tag: string
        }
        Update: {
          awarded_at?: string
          class_id?: string
          id?: string
          student_id?: string
          unit_tag?: string
        }
        Relationships: []
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
      can_message: {
        Args: { _class_id: string; _recipient: string; _sender: string }
        Returns: boolean
      }
      create_teacher_class: {
        Args: { _name: string; _subject: string }
        Returns: {
          created_at: string
          id: string
          join_code: string
          name: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_join_code: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_teacher: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_class_by_code: { Args: { _code: string }; Returns: string }
      reload_schema_cache: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "student" | "teacher"
      assignment_status: "not_started" | "in_progress" | "submitted"
      purchase_currency: "star" | "crown"
      purchase_kind: "cosmetic" | "privilege"
      purchase_status: "approved" | "pending" | "denied"
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
    Enums: {
      app_role: ["student", "teacher"],
      assignment_status: ["not_started", "in_progress", "submitted"],
      purchase_currency: ["star", "crown"],
      purchase_kind: ["cosmetic", "privilege"],
      purchase_status: ["approved", "pending", "denied"],
    },
  },
} as const
