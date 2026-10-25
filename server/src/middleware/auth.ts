import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User, type Role } from "../models/User";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header && header.startsWith("Bearer") ? header.split(" ")[1] ?? null : null;
}

export const protect: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/** Attaches req.user when a valid token is present, but never blocks the request. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      const user = await User.findById(decoded.id).select("-password");
      if (user) req.user = user;
    } catch {
      // invalid token on an optional-auth route: treat as anonymous
    }
  }
  next();
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    return next();
  };
