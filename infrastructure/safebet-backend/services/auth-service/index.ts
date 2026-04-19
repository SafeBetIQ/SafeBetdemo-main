import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createLogger } from '../../shared/logger';
import { unauthorized, forbidden, ok, badRequest, internalError, parseBody } from '../../shared/response';
import { extractBearerToken, verifyToken } from '../../shared/auth';

const COGNITO_REGION = process.env.COGNITO_REGION    ?? 'af-south-1';
const APP_CLIENT_ID  = process.env.COGNITO_CLIENT_ID ?? '';

const cognito = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

interface LoginBody {
  username: string;
  password: string;
}

// ---------------------------------------------------------------------------
// PUBLIC: POST /auth/login
// No Bearer token required — this IS the endpoint that issues tokens.
// ---------------------------------------------------------------------------
async function handleLogin(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const logger = createLogger('auth-service/login', event.requestContext?.requestId);

  let body: LoginBody;
  try {
    body = parseBody<LoginBody>(event.body);
  } catch {
    return badRequest('Request body must be valid JSON with username and password');
  }

  if (!body.username || !body.password) {
    return badRequest('username and password are required');
  }

  if (!APP_CLIENT_ID) {
    logger.warn('COGNITO_CLIENT_ID not configured');
    return internalError('Auth service is not configured');
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow:       'USER_PASSWORD_AUTH',
      ClientId:       APP_CLIENT_ID,
      AuthParameters: {
        USERNAME: body.username,
        PASSWORD: body.password,
      },
    });

    const result = await cognito.send(command);
    const tokens = result.AuthenticationResult;

    if (!tokens) {
      logger.warn('Cognito auth challenge', { challenge: result.ChallengeName });
      return ok(
        { challenge: result.ChallengeName, session: result.Session },
        undefined,
        202,
      );
    }

    logger.info('Login successful', { username: body.username });

    return ok({
      accessToken:  tokens.AccessToken,
      idToken:      tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      expiresIn:    tokens.ExpiresIn,
      tokenType:    tokens.TokenType,
    });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? '';
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
      return unauthorized('Incorrect username or password');
    }
    if (name === 'UserNotConfirmedException') {
      return unauthorized('Account is not confirmed. Check your email for a verification link.');
    }
    console.error('FULL ERROR:', err);
    const e = err as { code?: string; message?: string };
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: {
          code:    e.code ?? 'COGNITO_ERROR',
          message: e.message,
          details: err,
        },
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// PROTECTED: GET /auth/verify
// Requires a valid Bearer token. Returns the decoded claims.
// ---------------------------------------------------------------------------
async function handleVerify(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const logger = createLogger('auth-service/verify', event.requestContext?.requestId);

  try {
    const token = extractBearerToken(event);
    if (!token) {
      return unauthorized('Authorization header with Bearer token is required');
    }

    const claims = await verifyToken(token);
    logger.info('Token verified', { sub: claims.sub, casinoId: claims.casinoId });

    return ok({
      sub:      claims.sub,
      email:    claims.email,
      casinoId: claims.casinoId,
      groups:   claims.groups,
      exp:      claims.exp,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      const e = err as Error & { statusCode?: number };
      if (e.statusCode === 401) return unauthorized(err.message);
      if (e.statusCode === 403) return forbidden(err.message);
    }
    logger.error('Token verification failed', err);
    return internalError();
  }
}

// ---------------------------------------------------------------------------
// Lambda entry point — routing happens BEFORE any auth check.
// PUBLIC  (no token required):  POST /auth/login
// PROTECTED (token required):   GET  /auth/verify
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method   = event.httpMethod.toUpperCase();
  const resource = event.resource ?? event.path;

  if (method === 'POST' && resource.endsWith('/login'))  return handleLogin(event);
  if (method === 'GET'  && resource.endsWith('/verify')) return handleVerify(event);

  return { statusCode: 405, headers: { Allow: 'GET, POST' }, body: 'Method Not Allowed' };
};
