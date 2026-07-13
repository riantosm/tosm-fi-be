import { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/user.model";
import { IJwtPayload, verifyToken } from "../utils/jwt";
import { responseHandler } from "../utils/responseHandler";
import { ISafeUser } from "../interfaces/user.interface";

export interface AuthRequest extends Request {
  user?: IJwtPayload;
  currentUser?: ISafeUser;
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
        isSuccess: false,
        status: 401,
      });
    }

    req.user = verifyToken(token);
    next();
  } catch (error) {
    return responseHandler(res, {
      message: "Invalid or expired token",
      isSuccess: false,
      status: 401,
    });
  }
};

// Loads the user fresh from the DB (instead of trusting the JWT payload) so
// an admin's accept-user action — and a logout — takes effect immediately,
// without the token itself needing to expire or be re-issued.
export const requireActiveUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await UserModel.findById(req.user?.idUser).lean();

    if (!user) {
      return responseHandler(res, {
        message: "User tidak ditemukan",
        isSuccess: false,
        status: 401,
      });
    }

    const issuedAt = req.user?.iat;
    if (
      user.tokenValidAfter &&
      (issuedAt === undefined || issuedAt * 1000 < user.tokenValidAfter.getTime())
    ) {
      return responseHandler(res, {
        message: "Token sudah tidak berlaku, silakan login kembali",
        isSuccess: false,
        status: 401,
      });
    }

    if (user.status !== "active") {
      return responseHandler(res, {
        message: "Menunggu validasi",
        isSuccess: false,
        status: 403,
      });
    }

    req.currentUser = {
      idUser: user._id.toString(),
      nameUser: user.nameUser,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt!,
    };
    next();
  } catch (error) {
    return responseHandler(res, {
      message: "Gagal memverifikasi user",
      isSuccess: false,
      status: 500,
      error,
    });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.currentUser?.role !== "admin") {
    return responseHandler(res, {
      message: "Forbidden: admin only",
      isSuccess: false,
      status: 403,
    });
  }

  next();
};
