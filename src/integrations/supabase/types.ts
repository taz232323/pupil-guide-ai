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
      ai_coin_awards: {
        Row: {
          coins_awarded: number
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      assignment_answers: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          score: number | null
          selected_index: number | null
          student_id: string
          text_response: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          score?: number | null
          selected_index?: number | null
          student_id: string
          text_response?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          score?: number | null
          selected_index?: number | null
          student_id?: string
          text_response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_answers_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assignment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_grades: {
        Row: {
          assignment_id: string
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          overall_feedback: string | null
          overall_score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          overall_feedback?: string | null
          overall_score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          overall_feedback?: string | null
          overall_score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_questions: {
        Row: {
          assignment_id: string
          correct_index: number | null
          created_at: string
          id: string
          max_score: number
          options: Json | null
          position: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          assignment_id: string
          correct_index?: number | null
          created_at?: string
          id?: string
          max_score?: number
          options?: Json | null
          position?: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          assignment_id?: string
          correct_index?: number | null
          created_at?: string
          id?: string
          max_score?: number
          options?: Json | null
          position?: number
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assignment_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_reminder_log: {
        Row: {
          assignment_id: string
          channel: string
          id: string
          kind: string
          sent_at: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          channel?: string
          id?: string
          kind: string
          sent_at?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          channel?: string
          id?: string
          kind?: string
          sent_at?: string
          student_id?: string
        }
        Relationships: []
      }
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
          reminders_enabled: boolean
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
          reminders_enabled?: boolean
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
          reminders_enabled?: boolean
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
          daily_practice_enabled: boolean
          id: string
          join_code: string
          leaderboard_anonymous: boolean
          name: string
          subject: string
          syllabus: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_practice_enabled?: boolean
          id?: string
          join_code?: string
          leaderboard_anonymous?: boolean
          name: string
          subject: string
          syllabus?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_practice_enabled?: boolean
          id?: string
          join_code?: string
          leaderboard_anonymous?: boolean
          name?: string
          subject?: string
          syllabus?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          assignment_id: string | null
          created_at: string
          currency: string
          id: string
          note: string | null
          reason: string
          student_id: string
        }
        Insert: {
          amount: number
          assignment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          reason: string
          student_id: string
        }
        Update: {
          amount?: number
          assignment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          reason?: string
          student_id?: string
        }
        Relationships: []
      }
      cosmetics: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          name: string
          position_config: Json
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          name: string
          position_config?: Json
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          position_config?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_login_claims: {
        Row: {
          claim_date: string
          coins_amount: number
          created_at: string
          freezes_amount: number
          id: string
          reward_kind: string
          student_id: string
        }
        Insert: {
          claim_date?: string
          coins_amount?: number
          created_at?: string
          freezes_amount?: number
          id?: string
          reward_kind: string
          student_id: string
        }
        Update: {
          claim_date?: string
          coins_amount?: number
          created_at?: string
          freezes_amount?: number
          id?: string
          reward_kind?: string
          student_id?: string
        }
        Relationships: []
      }
      daily_practice_answers: {
        Row: {
          correct_index: number | null
          created_at: string
          expected_answer: string | null
          id: string
          is_correct: boolean | null
          options: Json | null
          position: number
          prompt: string
          question_type: string
          selected_index: number | null
          session_id: string
          student_id: string
          text_response: string | null
        }
        Insert: {
          correct_index?: number | null
          created_at?: string
          expected_answer?: string | null
          id?: string
          is_correct?: boolean | null
          options?: Json | null
          position: number
          prompt: string
          question_type: string
          selected_index?: number | null
          session_id: string
          student_id: string
          text_response?: string | null
        }
        Update: {
          correct_index?: number | null
          created_at?: string
          expected_answer?: string | null
          id?: string
          is_correct?: boolean | null
          options?: Json | null
          position?: number
          prompt?: string
          question_type?: string
          selected_index?: number | null
          session_id?: string
          student_id?: string
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_practice_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_practice_sessions: {
        Row: {
          bonus_coins_awarded: number
          class_id: string
          coins_awarded: number
          created_at: string
          id: string
          practice_date: string
          status: string
          student_id: string
          submitted_at: string | null
          total_answered: number
          total_correct: number
          updated_at: string
        }
        Insert: {
          bonus_coins_awarded?: number
          class_id: string
          coins_awarded?: number
          created_at?: string
          id?: string
          practice_date?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          total_answered?: number
          total_correct?: number
          updated_at?: string
        }
        Update: {
          bonus_coins_awarded?: number
          class_id?: string
          coins_awarded?: number
          created_at?: string
          id?: string
          practice_date?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_answered?: number
          total_correct?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_practice_streaks: {
        Row: {
          class_id: string
          current_streak: number
          id: string
          last_practice_date: string | null
          longest_streak: number
          milestones_awarded: number[]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          current_streak?: number
          id?: string
          last_practice_date?: string | null
          longest_streak?: number
          milestones_awarded?: number[]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          current_streak?: number
          id?: string
          last_practice_date?: string | null
          longest_streak?: number
          milestones_awarded?: number[]
          student_id?: string
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
      module_item_completions: {
        Row: {
          completed_at: string
          id: string
          item_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          item_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          item_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_item_completions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
        ]
      }
      module_items: {
        Row: {
          assignment_id: string | null
          content_html: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          item_type: Database["public"]["Enums"]["module_item_type"]
          module_id: string
          position: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          assignment_id?: string | null
          content_html?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["module_item_type"]
          module_id: string
          position?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          assignment_id?: string | null
          content_html?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["module_item_type"]
          module_id?: string
          position?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      personal_reminders: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          kind: string
          note: string | null
          start_at: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          kind?: string
          note?: string | null
          start_at: string
          student_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          kind?: string
          note?: string | null
          start_at?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_items: string[]
          created_at: string
          email_reminders_enabled: boolean
          full_name: string | null
          id: string
          inapp_reminders_enabled: boolean
          leaderboard_username: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_items?: string[]
          created_at?: string
          email_reminders_enabled?: boolean
          full_name?: string | null
          id: string
          inapp_reminders_enabled?: boolean
          leaderboard_username?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_items?: string[]
          created_at?: string
          email_reminders_enabled?: boolean
          full_name?: string | null
          id?: string
          inapp_reminders_enabled?: boolean
          leaderboard_username?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      quests: {
        Row: {
          active: boolean
          created_at: string
          description: string
          goal_type: string
          goal_value: number
          id: string
          kind: string
          quest_key: string
          reward_coins: number
          reward_freezes: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          goal_type: string
          goal_value: number
          id?: string
          kind: string
          quest_key: string
          reward_coins?: number
          reward_freezes?: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          goal_type?: string
          goal_value?: number
          id?: string
          kind?: string
          quest_key?: string
          reward_coins?: number
          reward_freezes?: number
          title?: string
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
      streak_freeze_activations: {
        Row: {
          class_id: string
          consumed: boolean
          consumed_at: string | null
          created_at: string
          id: string
          shield_date: string
          student_id: string
        }
        Insert: {
          class_id: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          id?: string
          shield_date: string
          student_id: string
        }
        Update: {
          class_id?: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          id?: string
          shield_date?: string
          student_id?: string
        }
        Relationships: []
      }
      student_coins: {
        Row: {
          crown_coins: number
          star_coins: number
          streak_freezes: number
          student_id: string
          updated_at: string
        }
        Insert: {
          crown_coins?: number
          star_coins?: number
          streak_freezes?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          crown_coins?: number
          star_coins?: number
          streak_freezes?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_quest_claims: {
        Row: {
          claimed_at: string
          id: string
          period_key: string
          quest_key: string
          reward_coins: number
          reward_freezes: number
          student_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          period_key: string
          quest_key: string
          reward_coins?: number
          reward_freezes?: number
          student_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          period_key?: string
          quest_key?: string
          reward_coins?: number
          reward_freezes?: number
          student_id?: string
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
      user_cosmetics: {
        Row: {
          acquired_at: string
          cosmetic_id: string
          equipped: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          cosmetic_id: string
          equipped?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          cosmetic_id?: string
          equipped?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cosmetics_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
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
      activate_streak_shield: {
        Args: { _class_id: string; _shield_date: string }
        Returns: Json
      }
      award_ai_message_coins: { Args: { _student_id: string }; Returns: number }
      can_message: {
        Args: { _class_id: string; _recipient: string; _sender: string }
        Returns: boolean
      }
      claim_daily_login_box: { Args: never; Returns: Json }
      claim_quest: { Args: { _quest_key: string }; Returns: Json }
      create_shop_purchase: {
        Args: { _class_id: string | null; _item_key: string }
        Returns: Json
      }
      create_teacher_class: {
        Args: { _name: string; _subject: string }
        Returns: {
          created_at: string
          daily_practice_enabled: boolean
          id: string
          join_code: string
          leaderboard_anonymous: boolean
          name: string
          subject: string
          syllabus: string | null
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
      grade_assignment_submission: {
        Args: {
          _answer_grades?: Json
          _assignment_id: string
          _overall_feedback?: string | null
          _overall_score?: number | null
          _student_id: string
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_quests_progress: {
        Args: never
        Returns: {
          claimed: boolean
          description: string
          goal_type: string
          goal_value: number
          kind: string
          period_key: string
          progress: number
          quest_key: string
          reward_coins: number
          reward_freezes: number
          title: string
        }[]
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
      resolve_shop_purchase: {
        Args: {
          _purchase_id: string
          _status: Database["public"]["Enums"]["purchase_status"]
        }
        Returns: Json
      }
      save_assignment_progress: {
        Args: { _answers: Json; _assignment_id: string }
        Returns: Json
      }
      set_assignment_status: {
        Args: {
          _assignment_id: string
          _status: Database["public"]["Enums"]["assignment_status"]
        }
        Returns: Json
      }
      submit_assignment: {
        Args: {
          _answers?: Json
          _assignment_id: string
          _file_path?: string | null
          _link_url?: string | null
        }
        Returns: Json
      }
      teacher_award_coins: {
        Args: {
          _amount: number
          _class_id: string
          _currency: string
          _reason: string
          _student_ids: string[]
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "student" | "teacher"
      assignment_status: "not_started" | "in_progress" | "submitted"
      module_item_type:
        | "lesson"
        | "announcement"
        | "file"
        | "link"
        | "assignment"
      purchase_currency: "star" | "crown"
      purchase_kind: "cosmetic" | "privilege"
      purchase_status: "approved" | "pending" | "denied"
      question_type: "multiple_choice" | "short_answer" | "long_answer"
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
      module_item_type: [
        "lesson",
        "announcement",
        "file",
        "link",
        "assignment",
      ],
      purchase_currency: ["star", "crown"],
      purchase_kind: ["cosmetic", "privilege"],
      purchase_status: ["approved", "pending", "denied"],
      question_type: ["multiple_choice", "short_answer", "long_answer"],
    },
  },
} as const
