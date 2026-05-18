import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';

export function GET(req: NextRequest) {
  Sentry.setTag('environment', process.env.NODE_ENV);

  if (req.nextUrl.searchParams.get('test_error') === '1') {
    Sentry.captureException(new Error('SENTRY TEST ERROR'));
    return new Response('Sentry test error captured', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}
