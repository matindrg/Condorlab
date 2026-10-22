import jwt, { type SignOptions } from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  sid: string;
  did: string;
  role?: string;
}

export function signToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '12h',
): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.sid || !decoded.did) {
    throw new Error('invalid token payload');
  }
  return {
    sub: String(decoded.sub),
    sid: String(decoded.sid),
    did: String(decoded.did),
    role: typeof decoded.role === 'string' ? decoded.role : undefined,
  };
}
