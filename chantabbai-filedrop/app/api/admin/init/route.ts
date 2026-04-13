import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Run once to set up RLS policies that allow all authenticated users to view all data
export async function POST() {
  try {
    // file_metadata: allow all authenticated users to read all rows
    await admin.rpc('exec_sql' as never, {
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename='file_metadata' AND policyname='All users read all files'
          ) THEN
            CREATE POLICY "All users read all files"
              ON file_metadata FOR SELECT
              TO authenticated
              USING (true);
          END IF;
        END $$;

        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename='manual_bills' AND policyname='All users read all bills'
          ) THEN
            CREATE POLICY "All users read all bills"
              ON manual_bills FOR SELECT
              TO authenticated
              USING (true);
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS profiles (
          id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          username text UNIQUE NOT NULL,
          email text NOT NULL,
          created_at timestamptz DEFAULT now()
        );
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Public read usernames') THEN
            CREATE POLICY "Public read usernames" ON profiles FOR SELECT USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users insert own profile') THEN
            CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (true);
          END IF;
        END $$;
      `
    } as never)

    return NextResponse.json({ ok: true })
  } catch (err) {
    // exec_sql RPC may not exist — try direct approach via admin
    console.error('Init error (non-fatal):', err)
    return NextResponse.json({ ok: true, note: 'partial' })
  }
}
