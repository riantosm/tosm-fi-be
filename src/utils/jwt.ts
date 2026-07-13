import jwt from "jsonwebtoken";
import { UserRole } from "../interfaces/user.interface";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = "7d";

export interface IJwtPayload {
  idUser: string;
  role: UserRole;
  // Added by jsonwebtoken automatically (seconds since epoch) — declared
  // here so callers can compare it against tokenValidAfter.
  iat?: number;
}

export const signToken = (payload: IJwtPayload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): IJwtPayload => {
  return jwt.verify(token, JWT_SECRET) as IJwtPayload;
};
