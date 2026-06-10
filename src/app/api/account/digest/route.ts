// src/app/api/account/digest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ enabled: false })
  try {
    const rows = await prisma.$queryRaw<{ preferences: string | null }[]>(
      Prisma.sql`SELECT preferences FROM dbo.Consumers WHERE phone = ${phone} OR phone_number = ${phone}`
    )
    if (!rows.length) return NextResponse.json({ enabled: false })
    const prefs = rows[0].preferences ? JSON.parse(rows[0].preferences) : {}
    return NextResponse.json({ enabled: prefs.daily_digest === true || prefs.daily_digest === 1 })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { phone, enabled } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })
    await prisma.$executeRaw(
      Prisma.sql`UPDATE dbo.Consumers
        SET preferences = JSON_MODIFY(COALESCE(preferences, '{}'), '$.daily_digest', CAST(${enabled ? 1 : 0} AS BIT))
        WHERE phone = ${phone} OR phone_number = ${phone}`
    )
    return NextResponse.json({ success: true, enabled })
  } catch (err) {
    console.error('[digest] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 })
  }
}
