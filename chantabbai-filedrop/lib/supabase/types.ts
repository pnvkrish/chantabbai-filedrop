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
      }
    }
    Functions: {
      increment_download_count: {
        Args: { file_id: string }
        Returns: void
      }
    }
  }
}
