import type { Request, Response, NextFunction } from "express";
import type { IncomingMessage } from "node:http";
import type { AuthMode } from "../config/env";

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function resolveAuthToken(
  authHeader: string | undefined,
  queryToken: string | null,
): string | null {
  return extractBearerToken(authHeader) ?? queryToken;
}

function readUpgradeQueryToken(req: IncomingMessage): string | null {
  if (!req.url) {
    return null;
  }

  const baseUrl = "http://localhost";
  let parsed: URL;
  try {
    parsed = new URL(req.url, baseUrl);
  } catch {
    return null;
  }

  const token = parsed.searchParams.get("access_token");
  return token && token.length > 0 ? token : null;
}

export function isAuthorizedUpgradeRequest(
  req: IncomingMessage,
  auth: AuthMode,
): boolean {
  if (!auth.enabled) {
    return true;
  }

  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const token = resolveAuthToken(authHeader, readUpgradeQueryToken(req));
  return Boolean(token && token === auth.token);
}

export function createAuthMiddleware(auth: AuthMode) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!auth.enabled) {
      next();
      return;
    }

    const token = resolveAuthToken(req.header("authorization"), null);
    if (!token || token !== auth.token) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    next();
  };
}
