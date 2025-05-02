import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic API route to receive and log errors from the client-side.
// In a real application, this would likely integrate with a
// dedicated logging service (e.g., Sentry, LogRocket, Google Cloud Logging).

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();

    // TODO: Implement actual server-side logging here
    // For now, just log to the server console
    console.error("Client-Side Error Logged:", errorData);

    // You could add more details like timestamp, user agent, etc.
    // await logErrorToService({ ...errorData, timestamp: new Date(), userAgent: request.headers.get('user-agent') });

    return NextResponse.json({ message: 'Error logged successfully' }, { status: 200 });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("Error logging client-side error:", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    // Avoid sending sensitive error details back to the client
    return NextResponse.json({ message: 'Failed to log error' }, { status: 500 });
  }
}

// Example of a function that would send logs to a service (replace with actual implementation)
// async function logErrorToService(errorDetails: any) {
//   console.log("Sending error to external service:", errorDetails);
//   // Example: fetch('https://your-logging-service.com/api/log', { method: 'POST', body: JSON.stringify(errorDetails) });
// }
