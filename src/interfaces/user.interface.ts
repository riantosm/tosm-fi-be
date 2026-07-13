export type UserRole = "admin" | "user";

export interface IUser {
  id_user: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface IRegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}
