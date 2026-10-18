/**
 * Hand-written to match supabase/migrations/20261018000001_init.sql.
 *
 * Once the Supabase project exists, replace this file with generated output:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 * Keep the shape in sync with the migration until then.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          address: string;
          lat: number;
          lng: number;
          note: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          display_name: string;
          address: string;
          lat: number;
          lng: number;
          note?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          address?: string;
          lat?: number;
          lng?: number;
          note?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_contacts: {
        Row: {
          id: string;
          company_id: string;
          contact_name: string | null;
          phone: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          contact_name?: string | null;
          phone?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          contact_name?: string | null;
          phone?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      save_company: {
        Args: {
          p_company_id: string | null;
          p_display_name: string;
          p_address: string;
          p_lat: number;
          p_lng: number;
          p_note: string | null;
          p_is_public: boolean;
          p_contacts: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type CompanyContact =
  Database["public"]["Tables"]["company_contacts"]["Row"];
