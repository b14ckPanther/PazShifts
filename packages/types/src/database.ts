/**
 * Supabase Database Schema Type Definitions for YellowShifts.
 * Reflects PostgreSQL tables, views, and functions created in Phase 2.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string;
          phone: string | null;
          preferred_locale: string;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          preferred_locale?: string;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          preferred_locale?: string;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_admins_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stations: {
        Row: {
          id: string;
          code: string;
          name: string;
          address: string | null;
          phone: string | null;
          timezone: string;
          is_active: boolean;
          nfc_public_token: string;
          allowed_late_minutes: number;
          allowed_early_leave_minutes: number;
          left_open_warning_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          nfc_public_token?: string;
          allowed_late_minutes?: number;
          allowed_early_leave_minutes?: number;
          left_open_warning_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          nfc_public_token?: string;
          allowed_late_minutes?: number;
          allowed_early_leave_minutes?: number;
          left_open_warning_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      station_memberships: {
        Row: {
          id: string;
          station_id: string;
          user_id: string;
          role: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
          status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          employee_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          user_id: string;
          role?: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          employee_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          user_id?: string;
          role?: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          employee_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'station_memberships_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'station_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shift_templates: {
        Row: {
          id: string;
          station_id: string;
          name: string;
          start_time: string;
          end_time: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          name: string;
          start_time: string;
          end_time: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          name?: string;
          start_time?: string;
          end_time?: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_templates_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      schedules: {
        Row: {
          id: string;
          station_id: string;
          week_start_date: string;
          status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          week_start_date: string;
          status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          week_start_date?: string;
          status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedules_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      scheduled_shifts: {
        Row: {
          id: string;
          schedule_id: string;
          station_id: string;
          shift_template_id: string | null;
          shift_date: string;
          start_at: string;
          end_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          station_id: string;
          shift_template_id?: string | null;
          shift_date: string;
          start_at: string;
          end_at: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          station_id?: string;
          shift_template_id?: string | null;
          shift_date?: string;
          start_at?: string;
          end_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scheduled_shifts_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scheduled_shifts_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      shift_assignments: {
        Row: {
          id: string;
          scheduled_shift_id: string;
          station_id: string;
          station_membership_id: string;
          status: 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scheduled_shift_id: string;
          station_id?: string;
          station_membership_id: string;
          status?: 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scheduled_shift_id?: string;
          station_id?: string;
          station_membership_id?: string;
          status?: 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_assignments_scheduled_shift_id_fkey';
            columns: ['scheduled_shift_id'];
            isOneToOne: false;
            referencedRelation: 'scheduled_shifts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shift_assignments_station_membership_id_fkey';
            columns: ['station_membership_id'];
            isOneToOne: false;
            referencedRelation: 'station_memberships';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_weeks: {
        Row: {
          id: string;
          station_id: string;
          station_membership_id: string;
          week_start_date: string;
          notes: string | null;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          station_membership_id: string;
          week_start_date: string;
          notes?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          station_membership_id?: string;
          week_start_date?: string;
          notes?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_weeks_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_weeks_station_membership_id_fkey';
            columns: ['station_membership_id'];
            isOneToOne: false;
            referencedRelation: 'station_memberships';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_entries: {
        Row: {
          id: string;
          availability_week_id: string;
          date: string;
          availability_type: 'ALL_DAY_AVAILABLE' | 'ALL_DAY_UNAVAILABLE' | 'TIME_WINDOW';
          start_time: string | null;
          end_time: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          availability_week_id: string;
          date: string;
          availability_type: 'ALL_DAY_AVAILABLE' | 'ALL_DAY_UNAVAILABLE' | 'TIME_WINDOW';
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          availability_week_id?: string;
          date?: string;
          availability_type?: 'ALL_DAY_AVAILABLE' | 'ALL_DAY_UNAVAILABLE' | 'TIME_WINDOW';
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_entries_availability_week_id_fkey';
            columns: ['availability_week_id'];
            isOneToOne: false;
            referencedRelation: 'availability_weeks';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          station_id: string;
          station_membership_id: string;
          user_id: string;
          scheduled_shift_id: string | null;
          clock_in_at: string;
          clock_out_at: string | null;
          status: 'ACTIVE' | 'COMPLETED' | 'FLAGGED';
          clock_in_source: 'NFC' | 'MANUAL_ADMIN';
          clock_out_source: 'NFC' | 'MANUAL_ADMIN' | null;
          corrected_by: string | null;
          correction_reason: string | null;
          corrected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          station_membership_id: string;
          user_id: string;
          scheduled_shift_id?: string | null;
          clock_in_at?: string;
          clock_out_at?: string | null;
          status?: 'ACTIVE' | 'COMPLETED' | 'FLAGGED';
          clock_in_source?: 'NFC' | 'MANUAL_ADMIN';
          clock_out_source?: 'NFC' | 'MANUAL_ADMIN' | null;
          corrected_by?: string | null;
          correction_reason?: string | null;
          corrected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          station_membership_id?: string;
          user_id?: string;
          scheduled_shift_id?: string | null;
          clock_in_at?: string;
          clock_out_at?: string | null;
          status?: 'ACTIVE' | 'COMPLETED' | 'FLAGGED';
          clock_in_source?: 'NFC' | 'MANUAL_ADMIN';
          clock_out_source?: 'NFC' | 'MANUAL_ADMIN' | null;
          corrected_by?: string | null;
          correction_reason?: string | null;
          corrected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_records_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_station_membership_id_fkey';
            columns: ['station_membership_id'];
            isOneToOne: false;
            referencedRelation: 'station_memberships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_scheduled_shift_id_fkey';
            columns: ['scheduled_shift_id'];
            isOneToOne: false;
            referencedRelation: 'scheduled_shifts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_corrected_by_fkey';
            columns: ['corrected_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      process_nfc_scan: {
        Args: { p_token: string; p_scan_id: string; p_scanned_at: string };
        Returns: Json;
      };
      is_platform_admin: {
        Args: {
          p_user_id?: string;
        };
        Returns: boolean;
      };
      has_station_membership: {
        Args: {
          p_station_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      has_station_role: {
        Args: {
          p_station_id: string;
          p_role: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_station_admin: {
        Args: {
          p_station_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      can_manage_station_schedule: {
        Args: {
          p_station_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      shares_active_station_with: {
        Args: {
          p_target_user_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      resolve_station_by_nfc_token: {
        Args: {
          p_token: string;
        };
        Returns: {
          id: string;
          code: string;
          name: string;
          address: string | null;
          timezone: string;
          is_active: boolean;
        }[];
      };
      rotate_station_nfc_token: {
        Args: {
          p_station_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      station_role: 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';
      membership_status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      schedule_status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
      shift_assignment_status: 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';
      availability_type: 'ALL_DAY_AVAILABLE' | 'ALL_DAY_UNAVAILABLE' | 'TIME_WINDOW';
      attendance_status: 'ACTIVE' | 'COMPLETED' | 'FLAGGED';
      attendance_source: 'NFC' | 'MANUAL_ADMIN';
    };
  };
}
