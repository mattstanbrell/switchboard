import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Read the raw text of the body:
    const rawBody = await request.text()
    console.log('Raw inbound body:\n', rawBody)

    // If you confirm it’s valid JSON, THEN parse:
    const body = JSON.parse(rawBody)
    console.log('Parsed body as JSON:\n', body)

    // ... proceed with your logic ...
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in inbound email route:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}