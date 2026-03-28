import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req, { params }) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
  }

  // Use the mocked JSON since there's no DB connected yet
  const filePath = path.join(process.cwd(), 'data', 'example_output.json');
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const mockData = JSON.parse(fileContent);
    // Maybe overwrite request_id just to be coherent, or return as is.
    mockData.request_id = id;
    
    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Failed to read mock data:', error);
    return NextResponse.json({ error: 'Internal server error while reading mock data' }, { status: 500 });
  }
}
