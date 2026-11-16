/**
 * Hand-written to match everything in supabase/migrations/.
 *
 * Once the Supabase project exists, replace this file with generated output:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 * Keep the shape in sync with the migration until then.
 */

/**
 * The check-constrained text columns. Postgres has no enum here — the project
 * style is an inline `check (... in (...))`, mirrored as a union on this side.
 */
export type TripSlot = "morning" | "afternoon";
export type TripTravelMode = "two-wheeler" | "driving";
export type TripMethod = "exact" | "heuristic";
export type PhotoKind = "order" | "receipt" | "warehouse" | "sample";

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
          default_start_label: string | null;
          default_start_lat: number | null;
          default_start_lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          default_start_label?: string | null;
          default_start_lat?: number | null;
          default_start_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          default_start_label?: string | null;
          default_start_lat?: number | null;
          default_start_lng?: number | null;
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
      trips: {
        Row: {
          id: string;
          user_id: string;
          trip_date: string;
          slot: TripSlot;
          slot_position: number;
          travel_mode: TripTravelMode;
          start_label: string;
          start_lat: number;
          start_lng: number;
          end_label: string | null;
          end_lat: number | null;
          end_lng: number | null;
          total_straight_km: number;
          method: TripMethod;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          trip_date: string;
          slot: TripSlot;
          slot_position?: number;
          travel_mode?: TripTravelMode;
          start_label: string;
          start_lat: number;
          start_lng: number;
          end_label?: string | null;
          end_lat?: number | null;
          end_lng?: number | null;
          total_straight_km: number;
          method: TripMethod;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trip_date?: string;
          slot?: TripSlot;
          slot_position?: number;
          travel_mode?: TripTravelMode;
          start_label?: string;
          start_lat?: number;
          start_lng?: number;
          end_label?: string | null;
          end_lat?: number | null;
          end_lng?: number | null;
          total_straight_km?: number;
          method?: TripMethod;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_stops: {
        Row: {
          id: string;
          trip_id: string;
          sort_order: number;
          company_id: string | null;
          display_name: string;
          address: string;
          lat: number;
          lng: number;
          leg_km: number | null;
          delivered_at: string | null;
          sample_taken: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          sort_order?: number;
          company_id?: string | null;
          display_name: string;
          address: string;
          lat: number;
          lng: number;
          leg_km?: number | null;
          delivered_at?: string | null;
          sample_taken?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          sort_order?: number;
          company_id?: string | null;
          display_name?: string;
          address?: string;
          lat?: number;
          lng?: number;
          leg_km?: number | null;
          delivered_at?: string | null;
          sample_taken?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_stops_trip_id_fkey";
            columns: ["trip_id"];
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_stops_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_stop_photos: {
        Row: {
          id: string;
          trip_stop_id: string;
          storage_path: string;
          kind: PhotoKind;
          note: string | null;
          taken_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_stop_id: string;
          storage_path: string;
          kind: PhotoKind;
          note?: string | null;
          taken_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_stop_id?: string;
          storage_path?: string;
          kind?: PhotoKind;
          note?: string | null;
          taken_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_stop_photos_trip_stop_id_fkey";
            columns: ["trip_stop_id"];
            referencedRelation: "trip_stops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      save_trip: {
        Args: {
          p_trip_id: string | null;
          p_trip_date: string;
          p_slot: TripSlot;
          p_travel_mode: TripTravelMode;
          p_start_label: string;
          p_start_lat: number;
          p_start_lng: number;
          p_end_label: string | null;
          p_end_lat: number | null;
          p_end_lng: number | null;
          p_total_km: number;
          p_method: TripMethod;
          p_note: string | null;
          p_stops: Json;
        };
        Returns: string;
      };
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
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type TripStop = Database["public"]["Tables"]["trip_stops"]["Row"];
export type TripStopPhoto =
  Database["public"]["Tables"]["trip_stop_photos"]["Row"];
