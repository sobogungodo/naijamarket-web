// src/app/api/account/referral/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function generateCode(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1 ambiguity
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  let h = Math.abs(hash)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[h % chars.length]
    h = Math.floor(h / chars.length)
  }
  return `NMI-${code}`
}

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ code: null })
  try {
    const rows = await prisma.$queryRaw<{ consumer_id: number; preferences: string | null }[]>(
      Prisma.sql`SELECT consumer_id, preferences FROM dbo.Consumers WHERE phone = ${phone} OR phone_number = ${phone}`
    )
    if (!rows.length) return NextResponse.json({ code: null })

    const prefs = rows[0].preferences ? JSON.parse(rows[0].preferences) : {}
    if (prefs.referral_code) return NextResponse.json({ code: prefs.referral_code })

    // Generate deterministic code and persist it for WA consistency
    const code = generateCode(`${rows[0].consumer_id}-${phone}`)
    await prisma.$executeRaw(
      Prisma.sql`UPDATE dbo.Consumers
        SET preferences = JSON_MODIFY(COALESCE(preferences, '{}'), '$.referral_code', ${code})
        WHERE consumer_id = ${rows[0].consumer_id}`
    )
    return NextResponse.json({ code })
  } catch (err) {
    console.error('[referral] GET error:', err)
    return NextResponse.json({ code: null })
  }
}
