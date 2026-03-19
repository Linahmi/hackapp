import { NextResponse } from 'next/server';
import { getDemoRequests } from '../../../lib/demoCache';

export async function GET() {
  return NextResponse.json(getDemoRequests());
}
