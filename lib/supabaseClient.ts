import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          email: string | null;
          avatar_initials: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          avatar_initials?: string | null;
          created_at?: string | null;
        };
        Update: {
          display_name?: string | null;
          email?: string | null;
          avatar_initials?: string | null;
        };
        Relationships: [];
      };
      quests: {
        Row: {
          id: string;
          creator_id: string | null;
          title: string | null;
          category: string | null;
          location: string | null;
          start_time: string | null;
          description: string | null;
          max_people: number | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id?: string | null;
          title?: string | null;
          category?: string | null;
          location?: string | null;
          start_time?: string | null;
          description?: string | null;
          max_people?: number | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          title?: string | null;
          category?: string | null;
          location?: string | null;
          start_time?: string | null;
          description?: string | null;
          max_people?: number | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quests_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quest_joins: {
        Row: {
          id: string;
          quest_id: string | null;
          user_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          quest_id?: string | null;
          user_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          quest_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quest_joins_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quest_joins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl!, supabaseAnonKey!);

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? "Supabase is not configured.");
  }

  return supabase;
}
