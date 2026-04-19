import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthenticatedClaims {
  sub:      string;
  email?:   string;   // present in ID tokens; absent in access tokens
  casinoId: string;   // custom:casino_id — tenant isolation key, always required
  groups:   string[];
  iat:      number;
  exp:      number;
}

// Internal type for Cognito access token payload including custom claims.
// aws-jwt-verify's CognitoAccessTokenPayload doesn't model custom attributes,
// so we cast to this after verification.
type CognitoIdPayload = {
  sub:                  string;
  exp:                  number;
  iat?:                 number;
  token_use?:           string;
  email?:               string;
  'custom:casino_id'?:  string;
  'cognito:groups'?:    string[];
};

// Created once per Lambda cold start — reuses the cached JWKS across invocations.
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse:   'id',
  clientId:   process.env.COGNITO_CLIENT_ID!,
});

export function extractBearerToken(event: APIGatewayProxyEvent): string | null {
  const header = event.headers?.['Authorization'] ?? event.headers?.['authorization'] ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function verifyToken(token: string): Promise<AuthenticatedClaims> {
  let payload: CognitoIdPayload;

  try {
    const raw = await verifier.verify(token);
    payload   = raw as unknown as CognitoIdPayload;
  } catch (err: unknown) {
    if (err instanceof Error) {
      const msg =
        err.name === 'JwtExpiredError'     ? 'Token has expired'
        : err.name === 'JwtNotBeforeError' ? 'Token not yet valid'
        : err.name.startsWith('Jwt')       ? 'Invalid token'
        : null;

      if (msg !== null) {
        throw Object.assign(new Error(msg), { statusCode: 401 });
      }
    }
    throw err;
  }

  // Defense-in-depth: verifier already enforces tokenUse:'id', but we
  // check the claim directly so this invariant is explicit and auditable.
  if (payload.token_use !== 'id') {
    throw Object.assign(
      new Error('Only ID tokens are accepted'),
      { statusCode: 401 },
    );
  }

  const casinoId = payload['custom:casino_id'];
  if (!casinoId) {
    throw Object.assign(
      new Error('Missing casino_id in token'),
      { statusCode: 403 },
    );
  }

  return {
    sub:      payload.sub,
    email:    payload.email,
    casinoId,
    groups:   payload['cognito:groups'] ?? [],
    iat:      payload.iat ?? 0,
    exp:      payload.exp,
  };
}

export function requireGroup(claims: AuthenticatedClaims, group: string): boolean {
  return claims.groups.includes(group);
}
