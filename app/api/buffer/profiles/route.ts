import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/lib/buffer'

/**
 * GET /api/buffer/profiles
 * Returns all connected Buffer social profiles
 * Protected: admin only
 */
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const profiles = await getProfiles()

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('Buffer profiles error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Buffer profiles' },
      { status: 500 }
    )
  }
}
