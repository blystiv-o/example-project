import type { Request } from 'express';

export interface RequestWithTrace extends Request {
  traceId: string;
  authUser?: { id: string };
  errorCode?: string;
}
