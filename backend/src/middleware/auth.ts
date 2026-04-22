import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

type AuthJwtPayload = jwt.JwtPayload & {
  userId: string;
  email: string;
};

const hasValidBearerPrefix = (authorizationHeader: string | undefined): boolean => {
  return typeof authorizationHeader === 'string' && /^Bearer\s+/i.test(authorizationHeader);
};

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!hasValidBearerPrefix(authHeader)) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader!.split(' ')[1]?.trim();

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  }, (err, decoded) => {
    if (err) {
      // 401: caller is not authenticated (token missing/invalid/expired)
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const payload = decoded as AuthJwtPayload;
    if (typeof payload.userId !== 'string' || payload.userId.trim().length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    (req as any).user = {
      userId: payload.userId,
      email: payload.email,
    };
    next();
  });
};
