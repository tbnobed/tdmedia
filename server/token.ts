import jwt from 'jsonwebtoken';
import { User } from '@shared/schema';

// Default expiration time for tokens (30 minutes)
const DEFAULT_TOKEN_EXPIRY = '30m';

// Interface for token payload
interface TokenPayload {
  userId: number;
  isAdmin: boolean;
  exp?: number;
  mediaId?: number; // Add mediaId for stream tokens
}

/**
 * Generate a JWT token for media access
 * @param user User object to generate token for
 * @param expiry Token expiration time (default 30 minutes)
 * @returns JWT token string
 */
export function generateMediaAccessToken(user: User, expiry = DEFAULT_TOKEN_EXPIRY): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'secure-media-secret';
  
  const payload: TokenPayload = {
    userId: user.id,
    isAdmin: !!user.isAdmin
  };
  
  return jwt.sign(payload, secret, { expiresIn: expiry as jwt.SignOptions['expiresIn'] });
}

/**
 * Verify a JWT token and extract the payload
 * @param token JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export function verifyMediaAccessToken(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'secure-media-secret';
  
  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Generate a short-lived token for streaming a specific media item
 * @param user User object to generate token for
 * @param mediaId ID of the media to stream
 * @returns JWT token string that expires in 15 minutes
 */
export function generateStreamToken(user: User, mediaId: number): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'secure-media-secret';
  
  const payload: TokenPayload = {
    userId: user.id,
    isAdmin: !!user.isAdmin,
    mediaId
  };
  
  // Short expiration for streaming tokens (15 minutes)
  return jwt.sign(payload, secret, { expiresIn: '15m' as jwt.SignOptions['expiresIn'] });
}