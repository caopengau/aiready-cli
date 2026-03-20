import { NextRequest, NextResponse } from 'next/server';

export async function withApiHandler(
  handler: (request: NextRequest, params?: any) => Promise<unknown>,
  request: NextRequest,
  params?: any
) {
  try {
    const result = await handler(request, params);
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (err) {
    console.error('API handler error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
