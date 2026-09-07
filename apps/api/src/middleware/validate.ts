import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const detalles = err.issues.map((i) => {
          const path = i.path.join(".");
          return `${path}: ${i.message}`;
        });
        res.status(400).json({ error: "Datos inválidos", detalles });
        return;
      }
      next(err);
    }
  };
}
