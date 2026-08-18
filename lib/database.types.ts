// Minimal manual types so Supabase client stops complaining.
// Replace with generated types (supabase gen types typescript) if you want full type safety later.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          recurrence: string;
          archived: boolean;
          due_date: string | null;
          category: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          recurrence?: string;
          archived?: boolean;
          due_date?: string | null;
          category?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          recurrence?: string;
          archived?: boolean;
          due_date?: string | null;
          category?: string;
          user_id?: string | null;
          created_at?: string;
        };
      };
      completions: {
        Row: {
          id: string;
          task_id: string;
          task_title: string;
          completed_on: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          task_title: string;
          completed_on: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          task_title?: string;
          completed_on?: string;
          user_id?: string | null;
          created_at?: string;
        };
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          completed: boolean;
          position: number;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          completed?: boolean;
          position?: number;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          completed?: boolean;
          position?: number;
          user_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
