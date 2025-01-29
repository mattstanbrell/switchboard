export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          email: string
          id: string
          name: string
        }
        Insert: {
          email: string
          id?: string
          name: string
        }
        Update: {
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      field_definitions: {
        Row: {
          allows_multiple: boolean
          company_id: string
          display_order: number
          field_type: string
          id: number
          is_required: boolean
          label: string
          name: string
          options: Json[] | null
        }
        Insert: {
          allows_multiple?: boolean
          company_id: string
          display_order: number
          field_type: string
          id?: number
          is_required?: boolean
          label: string
          name: string
          options?: Json[] | null
        }
        Update: {
          allows_multiple?: boolean
          company_id?: string
          display_order?: number
          field_type?: string
          id?: number
          is_required?: boolean
          label?: string
          name?: string
          options?: Json[] | null
        }
        Relationships: [
          {
            foreignKeyName: "field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_areas: {
        Row: {
          company_id: string
          id: number
          name: string
        }
        Insert: {
          company_id: string
          id?: number
          name: string
        }
        Update: {
          company_id?: string
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_areas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          content: string
          created_at: string
          human_agent_id: string
          id: number
          ticket_id: number
        }
        Insert: {
          content: string
          created_at?: string
          human_agent_id: string
          id?: number
          ticket_id: number
        }
        Update: {
          content?: string
          created_at?: string
          human_agent_id?: string
          id?: number
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_human_agent_id_fkey"
            columns: ["human_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          email_message_id: string | null
          email_references: string[] | null
          id: number
          sender_id: string
          ticket_id: number
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          content: string
          created_at?: string
          email_message_id?: string | null
          email_references?: string[] | null
          id?: number
          sender_id: string
          ticket_id: number
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          content?: string
          created_at?: string
          email_message_id?: string | null
          email_references?: string[] | null
          id?: number
          sender_id?: string
          ticket_id?: number
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_emails: {
        Row: {
          company_id: string
          message_id: string
          processed_at: string
        }
        Insert: {
          company_id: string
          message_id: string
          processed_at?: string
        }
        Update: {
          company_id?: string
          message_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          last_seen: string | null
          role: string
          team_id: number | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_seen?: string | null
          role: string
          team_id?: number | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen?: string | null
          role?: string
          team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_focus_areas: {
        Row: {
          focus_area_id: number
          team_id: number
        }
        Insert: {
          focus_area_id: number
          team_id: number
        }
        Update: {
          focus_area_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_focus_areas_focus_area_id_fkey"
            columns: ["focus_area_id"]
            isOneToOne: false
            referencedRelation: "focus_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_focus_areas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string
          id: number
          name: string
        }
        Insert: {
          company_id: string
          id?: number
          name: string
        }
        Update: {
          company_id?: string
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_fields: {
        Row: {
          field_definition_id: number
          ticket_id: number
          value: string | null
        }
        Insert: {
          field_definition_id: number
          ticket_id: number
          value?: string | null
        }
        Update: {
          field_definition_id?: number
          ticket_id?: number
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_fields_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_fields_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_id: string
          email: string | null
          focus_area_id: number | null
          human_agent_id: string | null
          id: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: string
          team_id: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_id: string
          email?: string | null
          focus_area_id?: number | null
          human_agent_id?: string | null
          id?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: string
          team_id?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          email?: string | null
          focus_area_id?: number | null
          human_agent_id?: string | null
          id?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: string
          team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_focus_area_id_fkey"
            columns: ["focus_area_id"]
            isOneToOne: false
            referencedRelation: "focus_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_human_agent_id_fkey"
            columns: ["human_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_agent_to_team: {
        Args: {
          agent_id: string
          team_id: number
          admin_id: string
        }
        Returns: undefined
      }
      check_and_record_email: {
        Args: {
          p_message_id: string
          p_company_id: string
        }
        Returns: boolean
      }
      close_resolved_ticket: {
        Args: {
          ticket_id_param: number
          agent_id_param: string
          job_name: string
        }
        Returns: undefined
      }
      generate_company_email: {
        Args: {
          company_name: string
        }
        Returns: string
      }
      get_companies: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
        }[]
      }
      get_company_profiles: {
        Args: {
          company_id_input: string
        }
        Returns: {
          avatar_url: string | null
          company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          last_seen: string | null
          role: string
          team_id: number | null
        }[]
      }
      get_profile: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          role: string
          company_id: string
        }[]
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      handle_inbound_email: {
        Args: {
          from_email: string
          subject?: string
          text_content?: string
          html_content?: string
        }
        Returns: Json
      }
      process_inbound_email:
        | {
            Args: {
              customer_id: string
              target_company_id: string
              from_email: string
              subject?: string
              text_content?: string
              html_content?: string
            }
            Returns: Json
          }
        | {
            Args: {
              customer_id: string
              target_company_id: string
              from_email: string
              subject?: string
              text_content?: string
              html_content?: string
              focus_area?: string
            }
            Returns: Json
          }
        | {
            Args: {
              customer_id: string
              target_company_id: string
              from_email: string
              subject?: string
              text_content?: string
              html_content?: string
              focus_area?: string
              message_id?: string
            }
            Returns: Json
          }
      schedule_auto_close: {
        Args: {
          job_name: string
          ticket_id: number
          agent_id: string
          minutes_until_close: number
        }
        Returns: undefined
      }
      unschedule_job: {
        Args: {
          job_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      message_type: "user" | "system"
      ticket_priority: "Low" | "Medium" | "High"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
