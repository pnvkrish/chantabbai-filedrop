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
  }
}

export type DbFileMetadata = Database['public']['Tables']['file_metadata']['Row']
export type DbFileInsert = Database['public']['Tables']['file_metadata']['Insert']
export type DbFileUpdate = Database['public']['Tables']['file_metadata']['Update']

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
