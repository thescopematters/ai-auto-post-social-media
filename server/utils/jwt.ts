/**
 * JWT token utilities for authentication
 * Handles token generation, signing, and verification
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config/environment';
import { AuthenticationError } from './errors';

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  userId: string;
  email: string;
  workspaceId?: string;
}

/**
 * Generate an access token
 * @param payload Token payload containing user information
 * @returns Signed JWT access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.expiresIn as any,
  };
  return jwt.sign(payload, config.jwt.secret, options);
};

/**
 * Generate a refresh token
 * @param payload Token payload containing user information
 * @returns Signed JWT refresh token with longer expiration
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as any,
  };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

/**
 * Verify and decode an access token
 * @param token JWT access token to verify
 * @returns Decoded token payload
 * @throws AuthenticationError if token is invalid or expired
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    throw new AuthenticationError('Invalid or expired access token');
  }
};

/**
 * Verify and decode a refresh token
 * @param token JWT refresh token to verify
 * @returns Decoded token payload
 * @throws AuthenticationError if token is invalid or expired
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch (error) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }
};
