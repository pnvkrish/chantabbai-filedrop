import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Ensure profiles table exists
async function ensureProfilesTable() {
  await adminSupabase.rpc('exec_sql', {
    sql: `
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
          CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
        END IF;
      END $$;
    `
  }).throwOnError()
}

// POST /api/auth/username
// body: { action: 'lookup', username } | { action: 'register', userId, username, email }
export async function POST(req: Request) {
  try {
    const body = await req.json() as { action: string; username?: string; userId?: string; email?: string }

    if (body.action === 'register') {
      const { userId, username, email } = body
      if (!userId || !username || !email) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      }

      // Create table if needed, then upsert profile
      try {
        await adminSupabase.from('profiles').upsert({ id: userId, username: username.toLowerCase(), email }).throwOnError()
      } catch {
        // Table may not exist — create it via direct insert into pg
        await adminSupabase.rpc('exec_sql', {
          sql: `
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
            INSERT INTO profiles (id, username, email)
            VALUES ('${userId}', '${username.toLowerCase().replace(/'/g, "''")}', '${email.replace(/'/g, "''")}')
            ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email;
          `
        })
      }
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'lookup') {
      const { username } = body
      if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

      const { data, error } = await adminSupabase
        .from('profiles')
        .select('email')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (error) return NextResponse.json({ error: 'Username not found' }, { status: 404 })
      if (!data) return NextResponse.json({ error: 'Username not found' }, { status: 404 })

      return NextResponse.json({ email: data.email })
    }

    if (body.action === 'check') {
      const { username } = body
      if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })
      const { data } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle()
      return NextResponse.json({ available: !data })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Auth username error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
