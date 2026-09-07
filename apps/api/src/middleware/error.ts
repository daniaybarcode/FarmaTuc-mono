import type { Request, Response, NextFunction, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Wrapper que captura errores de handlers asíncronos y los deriva
 * al error handler central. Genérico sobre la firma del handler para
 * preservar el tipado exacto de Request (params, body, query) que
 * declara cada controller.
 */
export function asyncHandler<P, ResBody, ReqBody, ReqQuery>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<void>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Error interno:", err);
  res.status(500).json({ error: "Error interno del servidor" });
}
