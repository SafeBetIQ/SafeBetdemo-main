import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Casino-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function ok<T>(data: T, meta?: Record<string, unknown>, statusCode = 200): APIGatewayProxyResult {
  const body: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created<T>(data: T): APIGatewayProxyResult {
  return ok(data, undefined, 201);
}

export function noContent(): APIGatewayProxyResult {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export function badRequest(message: string, code = 'BAD_REQUEST'): APIGatewayProxyResult {
  return error(400, code, message);
}

export function unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): APIGatewayProxyResult {
  return error(401, code, message);
}

export function forbidden(message = 'Forbidden', code = 'FORBIDDEN'): APIGatewayProxyResult {
  return error(403, code, message);
}

export function notFound(resource: string): APIGatewayProxyResult {
  return error(404, 'NOT_FOUND', `${resource} not found`);
}

export function conflict(message: string): APIGatewayProxyResult {
  return error(409, 'CONFLICT', message);
}

export function internalError(message = 'An unexpected error occurred'): APIGatewayProxyResult {
  return error(500, 'INTERNAL_SERVER_ERROR', message);
}

function error(statusCode: number, code: string, message: string): APIGatewayProxyResult {
  const body: ApiError = { success: false, error: { code, message } };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function parseBody<T>(raw: string | null): T {
  if (!raw) throw new SyntaxError('Empty request body');
  return JSON.parse(raw) as T;
}
