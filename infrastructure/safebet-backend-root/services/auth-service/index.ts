import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { createLogger } from '../../shared/logger';
import { unauthorized, forbidden, ok, internalError } from '../../shared/response';


// ---------------------------------------------------------------------------
// Cognito configuration — supplied via Lambda environment variables.
// Set these when deploying to API Gateway + Cognito User Pool.
// ---------------------------------------------------------------------------
const COGNITO_REGION     = process.env.COGNITO_REGION    ?? 'eu-west-1';
const USER_POOL_ID       = process.env.COGNITO_USER_POOL_ID ?? '';
const APP_CLIENT_ID      = process.env.COGNITO_CLIENT_ID    ?? '';
const JWKS_URI           = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 600_000, // 10 minutes
});

export interface AuthenticatedClaims {
  sub:       string;     // Cognito sub (immutable user identity)
  email:     string;
  casinoId:  string;     // custom:casino_id claim from Cognito
  groups:    string[];   // cognito:groups
  iat:       number;
  exp:       number;
}

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('Signing key not found'));
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyToken(token: string): Promise<AuthenticatedClaims> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload !== 'object' || !decoded.header.kid) {
    throw Object.assign(new Error('Malformed token'), { statusCode: 401 });
  }

  const signingKey = await getSigningKey(decoded.header.kid);

  const payload = jwt.verify(token, signingKey, {
    algorithms: ['RS256'],
    audience:   APP_CLIENT_ID  || undefined,
    issuer:     `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${USER_POOL_ID}` || undefined,
  }) as Record<string, unknown>;

  const casinoId = (payload['custom:casino_id'] ?? payload['casino_id'] ?? '') as string;
  if (!casinoId) throw Object.assign(new Error('Token missing casino_id claim'), { statusCode: 403 });

  const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];

  return {
    sub:      payload.sub as string,
    email:    payload.email as string,
    casinoId,
    groups,
    iat:      payload.iat as number,
    exp:      payload.exp as number,
  };
}

export function extractBearerToken(event: APIGatewayProxyEvent): string | null {
  const header = event.headers?.['Authorization'] ?? event.headers?.['authorization'] ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export function requireGroup(claims: AuthenticatedClaims, group: string): boolean {
  return claims.groups.includes(group);
}

// ---------------------------------------------------------------------------
// Lambda handler — token introspection / health endpoint
// Used by API Gateway authorizer or direct invocation to validate a token.
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger = createLogger('auth-service', requestId);

  try {
    const token = extractBearerToken(event);
    if (!token) {
      logger.warn('Missing Authorization header');
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
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return unauthorized('Token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return unauthorized('Invalid token signature');
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 403) return forbidden((err as Error).message);
    if (status === 401) return unauthorized((err as Error).message);

    logger.error('Token verification failed', err);
    return internalError();
  }
};
