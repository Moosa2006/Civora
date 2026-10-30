import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'civora-development-jwt-secret-min-32-characters-required';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signAuthToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

export function verifyAuthToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (_err) {
    return null;
  }
}
