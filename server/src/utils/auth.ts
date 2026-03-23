import jwt from "jsonwebtoken";
import { config } from "./config.js";
import type { Request, Response, NextFunction } from "express";

interface TokenPayload {
  username: string;
  iat: number;
  exp: number;
}

export function generateToken(username: string): string {
  return jwt.sign({ username }, config.authJwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.authJwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

/** Express middleware — protects routes with JWT auth */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  next();
}
