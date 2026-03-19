import { NextResponse } from 'next/server';
import { getData } from '@/lib/dataLoader';
export async function GET(request, { params }) {
  const { id } = await params;
  const data = getData();
  const reqObj = (data.requests || []).find(r => r.request_id === id);

  if (!reqObj) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  return NextResponse.json(reqObj);
}