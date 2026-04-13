import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// ─── Database schema types ────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      file_metadata: {
        Row: {
          id: string
          user_id: string
          name: string
          original_name: string
          size: number
          mime_type: string
          extension: string
          storage_path: string
          checksum: string
          tags: string[]
          is_starred: boolean
          download_count: number
          uploaded_at: string
          updated_at: string
          category: string | null
          vendor_name: string | null
          bill_amount: number | null
          bill_date: string | null
          approval_status: 'pending' | 'approved' | 'rejected' | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          original_name: string
          size: number
          mime_type: string
          extension: string
          storage_path: string
          checksum: string
          tags?: string[]
          is_starred?: boolean
          download_count?: number
          uploaded_at?: string
          updated_at?: string
          category?: string | null
          vendor_name?: string | null
          bill_amount?: number | null
          bill_date?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected' | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          original_name?: string
          size?: number
          mime_type?: string
          extension?: string
          storage_path?: string
          checksum?: string
          tags?: string[]
          is_starred?: boolean
          download_count?: number
          uploaded_at?: string
          updated_at?: string
          category?: string | null
          vendor_name?: string | null
          bill_amount?: number | null
          bill_date?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected' | null
        }
        Relationships: []
      }
      budget_settings: {
        Row: {
          id: string
          user_id: string
          category: string
          monthly_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          monthly_limit: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          monthly_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      manual_bills: {
        Row: {
          id: string
          user_id: string
          vendor_name: string | null
          category: string | null
          bill_amount: number | null
          bill_date: string | null
          description: string | null
          approval_status: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vendor_name?: string | null
          category?: string | null
          bill_amount?: number | null
          bill_date?: string | null
          description?: string | null
          approval_status?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          vendor_name?: string | null
          category?: string | null
          bill_amount?: number | null
          bill_date?: string | null
          description?: string | null
          approval_status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      increment_download_count: {
        Args: { file_id: string }
        Returns: undefined
      }
    }
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type DbFileMetadata = Database['public']['Tables']['file_metadata']['Row'] & {
  uploaded_by?: string | null
}
export type DbFileInsert = Database['public']['Tables']['file_metadata']['Insert']
export type DbFileUpdate = Database['public']['Tables']['file_metadata']['Update']
export type BudgetSetting = Database['public']['Tables']['budget_settings']['Row']
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

// ─── Client singleton ─────────────────────────────────────────────────────────

// Use createBrowserClient from @supabase/ssr so cookies are set correctly
// and the middleware can read the session
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Keep for backward compat
export function createSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Suppress unused import warning
void createClient
