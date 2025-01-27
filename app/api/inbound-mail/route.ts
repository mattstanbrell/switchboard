import { NextResponse } from 'next/server'

// Example for Next.js App Router:
export async function POST(request: Request) {
  try {
    // If SendGrid is sending JSON:
    const jsonBody = await request.json()
    console.log('SendGrid parsed data:', jsonBody)

    // Or, if SendGrid is sending form-data, parse with a library:
    // (e.g., 'formidable' - though the app router currently requires a workaround)
    // const formData = await request.formData()
    // const subject = formData.get('subject')

    // Do something with the content; e.g., create a ticket in your DB
    // ...

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in inbound email route:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}