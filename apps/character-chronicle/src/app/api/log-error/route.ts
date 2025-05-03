
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logError, logMessage } from '@/services/logging-service'; // Use frontend logging service

// API route to receive and log errors from the client-side.
// This might forward logs to the NestJS API or handle them differently now.
export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ip = request.ip || 'Unknown IP';

    // Log the received client-side error using the frontend logging service
    // This service might internally call the NestJS API's logging endpoint
    await logMessage('error', 'Client-Side Error Reported', {
        clientError: errorData,
        userAgent: userAgent,
        sourceIp: ip,
        source: 'ClientErrorHandler',
    });

    return NextResponse.json({ message: 'Error logged successfully' }, { status: 200 });
  } catch (e) {
    // Log the error that occurred *within this API route*
    const error = e instanceof Error ? e : new Error(String(e));
    // Use logError for server-side errors occurring in this handler
    await logError(error, {
        context: 'Error handling client-side log request',
        source: 'api/log-error',
    });

    // Avoid sending sensitive error details back to the client
    return NextResponse.json({ message: 'Failed to log error on server' }, { status: 500 });
  }
}
