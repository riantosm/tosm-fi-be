export interface IClientError {
  idUser: string | null;
  source: string;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
}

export interface ICreateClientErrorInput {
  source: string;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
}

export interface ISafeClientError {
  idClientError: string;
  idUser: string | null;
  source: string;
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
  createdAt: Date;
}
