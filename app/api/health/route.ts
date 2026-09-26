import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  );
}
