export type ClientErrorEnvironment = "development" | "production";

export interface IClientError {
  idUser: string | null;
  source: string;
  environment: ClientErrorEnvironment;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
  isRead: boolean;
}

export interface ICreateClientErrorInput {
  source: string;
  environment: ClientErrorEnvironment;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
}

export interface IClientErrorListQuery {
  search?: string;
  environment?: ClientErrorEnvironment;
  source?: string;
}

export interface ISafeClientError {
  idClientError: string;
  idUser: string | null;
  username: string | null;
  source: string;
  environment: ClientErrorEnvironment;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}
