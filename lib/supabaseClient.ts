import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          handle: string;
          email: string | null;
          phone: string | null;
          avatar_initials: string | null;
          avatar_url: string | null;
          website_url: string | null;
          bio: string | null;
          pronouns: string | null;
          area: string;
          interests: string[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          display_name?: string | null;
          handle?: string;
          email?: string | null;
          phone?: string | null;
          avatar_initials?: string | null;
          avatar_url?: string | null;
          website_url?: string | null;
          bio?: string | null;
          pronouns?: string | null;
          area?: string;
          interests?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          display_name?: string | null;
          handle?: string;
          email?: string | null;
          phone?: string | null;
          avatar_initials?: string | null;
          avatar_url?: string | null;
          website_url?: string | null;
          bio?: string | null;
          pronouns?: string | null;
          area?: string;
          interests?: string[] | null;
          updated_at?: string | null;
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
          card_image_url: string | null;
          area: string;
          visibility: "invite_only" | "friends" | "local";
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
          card_image_url?: string | null;
          area?: string;
          visibility?: "invite_only" | "friends" | "local";
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
          card_image_url?: string | null;
          area?: string;
          visibility?: "invite_only" | "friends" | "local";
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
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "declined";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: "pending" | "accepted" | "declined";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "declined";
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quest_invites: {
        Row: {
          id: string;
          quest_id: string;
          inviter_id: string;
          invitee_id: string;
          status: "pending" | "accepted" | "declined";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          quest_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: "pending" | "accepted" | "declined";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "declined";
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quest_invites_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quest_invites_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quest_invites_invitee_id_fkey";
            columns: ["invitee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quest_share_links: {
        Row: {
          id: string;
          quest_id: string;
          created_by: string;
          token: string;
          revoked_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          quest_id: string;
          created_by: string;
          token?: string;
          revoked_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          revoked_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quest_share_links_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quest_share_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: "ios" | "android" | "web";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: "ios" | "android" | "web";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          token?: string;
          platform?: "ios" | "android" | "web";
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_events: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          quest_id: string | null;
          type: string;
          title: string;
          body: string | null;
          read_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id?: string | null;
          quest_id?: string | null;
          type: string;
          title: string;
          body?: string | null;
          read_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
        ];
      };
      message_threads: {
        Row: {
          id: string;
          kind: "direct" | "event";
          quest_id: string | null;
          direct_key: string | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          kind: "direct" | "event";
          quest_id?: string | null;
          direct_key?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          last_message_at?: string | null;
        };
        Update: {
          quest_id?: string | null;
          direct_key?: string | null;
          updated_at?: string | null;
          last_message_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_threads_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_thread_participants: {
        Row: {
          thread_id: string;
          user_id: string;
          last_read_at: string | null;
          created_at: string | null;
        };
        Insert: {
          thread_id: string;
          user_id: string;
          last_read_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          last_read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_thread_participants_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_thread_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at?: string | null;
        };
        Update: {
          body?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_access_message_thread: {
        Args: { target_thread_id: string; target_user_id: string };
        Returns: boolean;
      };
      create_quest_share_link: {
        Args: { target_quest_id: string };
        Returns: { token: string; created: boolean }[];
      };
      direct_message_key: {
        Args: { left_user_id: string; right_user_id: string };
        Returns: string;
      };
      get_or_create_direct_thread: {
        Args: { target_user_id: string };
        Returns: string;
      };
      get_or_create_event_thread: {
        Args: { target_quest_id: string };
        Returns: string;
      };
      get_public_quest_share: {
        Args: { share_token: string };
        Returns: {
          token: string;
          quest_id: string;
          title: string;
          category: string;
          location: string;
          start_time: string | null;
          description: string | null;
          card_image_url: string | null;
          visibility: string;
          status: string;
          host_display_name: string | null;
          host_handle: string | null;
          going_count: number;
          max_people: number;
          created_at: string | null;
        }[];
      };
      join_quest_atomic: {
        Args: { target_quest_id: string };
        Returns: "joined" | "already_joined";
      };
      is_event_chat_member: {
        Args: { target_quest_id: string; target_user_id: string };
        Returns: boolean;
      };
      sync_event_thread_participants: {
        Args: { target_thread_id: string; target_quest_id: string };
        Returns: undefined;
      };
    };
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
