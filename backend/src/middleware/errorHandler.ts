import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { captureException } from '../monitoring/sentry';

const safeError = (message: string, details?: Array<{ field: string; message: string }>) => {
  return details ? { error: message, details } : { error: message };
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(safeError('Not found'));
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json(safeError('Invalid JSON payload'));
    return;
  }

  if (typeof err?.message === 'string' && err.message.includes('CORS origin not allowed')) {
    res.status(403).json(safeError('Forbidden'));
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json(safeError('Invalid request'));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json(safeError('Conflict'));
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json(safeError('Resource not found'));
      return;
    }

    res.status(400).json(safeError('Invalid request'));
    return;
  }

  logger.error(`Unhandled server error on ${req.method} ${req.originalUrl}`);
  captureException(err);

  const message = env.isProduction ? 'Something went wrong' : (err?.message || 'Something went wrong');
  res.status(500).json(safeError(message));
};
