import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { adminAuth } from '../lib/firebase-admin.ts';

const WORKSPACE_TOKEN_SECRET =
  process.env.WORKSPACE_TOKEN_SECRET ||
  `taskflow-workspace-secret-${process.env.SQL_DB_NAME || 'default'}`;

export interface AuthenticatedUser {
  uid: string;
  email: string;
  isAnonymous: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Signs an isolated anonymous workspace session token using HMAC-SHA256
 * so the application opens directly into an authenticated, isolated workspace
 * without a login or registration screen (Section 3 & Section 13).
 */
export function createAnonymousWorkspaceToken(existingUid?: string): {
  token: string;
  uid: string;
  email: string;
  isAnonymous: boolean;
} {
  const uid =
    existingUid && /^anon_[a-f0-9-]{20,40}$/.test(existingUid)
      ? existingUid
      : `anon_${crypto.randomUUID()}`;
  const issuedAt = Date.now();
  const payload = `${uid}.${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', WORKSPACE_TOKEN_SECRET)
    .update(payload)
    .digest('hex');

  return {
    token: `tf_anon.${payload}.${sig}`,
    uid,
    email: `${uid}@anonymous.taskflow.local`,
    isAnonymous: true,
  };
}

export function verifyAnonymousWorkspaceToken(
  token: string
): AuthenticatedUser | null {
  if (!token.startsWith('tf_anon.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [, uid, issuedAt, sig] = parts;
  if (!uid || !issuedAt || !sig) return null;

  const payload = `${uid}.${issuedAt}`;
  const expectedSig = crypto
    .createHmac('sha256', WORKSPACE_TOKEN_SECRET)
    .update(payload)
    .digest('hex');

  if (sig.length !== expectedSig.length) return null;
  const valid = crypto.timingSafeEqual(
    Buffer.from(sig, 'utf8'),
    Buffer.from(expectedSig, 'utf8')
  );
  if (!valid) return null;

  return {
    uid,
    email: `${uid}@anonymous.taskflow.local`,
    isAnonymous: true,
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing Authorization Bearer token.',
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Empty bearer token.',
    });
  }

  // 1. Check server-signed anonymous workspace token
  const anonUser = verifyAnonymousWorkspaceToken(token);
  if (anonUser) {
    req.user = anonUser;
    return next();
  }

  // 2. Otherwise verify Firebase ID Token via Firebase Admin
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@workspace.taskflow.local`,
      isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
    };
    return next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired session token.',
    });
  }
};
