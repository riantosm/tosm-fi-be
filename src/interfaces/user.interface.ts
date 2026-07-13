export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "active";

export interface IUser {
  nameUser: string;
  username: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  // Tokens issued before this timestamp are rejected — set on logout so a
  // JWT can be invalidated server-side despite being otherwise stateless.
  tokenValidAfter: Date | null;
}

export interface IRegisterInput {
  nameUser: string;
  username: string;
  password: string;
}

export interface ILoginInput {
  username: string;
  password: string;
}

export interface ISafeUser {
  idUser: string;
  nameUser: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}
