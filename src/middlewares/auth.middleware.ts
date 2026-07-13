import { NextFunction, Request, Response } from "express";
import { IJwtPayload, verifyToken } from "../utils/jwt";
import { responseHandler } from "../utils/responseHandler";

export interface AuthRequest extends Request {
  user?: IJwtPayload;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return responseHandler(res, {
        message: "Unauthorized",
        is_success: false,
        status: 401,
      });
    }

    req.user = verifyToken(token);
    next();
  } catch (error) {
    return responseHandler(res, {
      message: "Invalid or expired token",
      is_success: false,
      status: 401,
    });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== "admin") {
    return responseHandler(res, {
      message: "Forbidden: admin only",
      is_success: false,
      status: 403,
    });
  }

  next();
};
