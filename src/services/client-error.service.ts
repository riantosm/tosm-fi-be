import {
  ICreateClientErrorInput,
  IClientErrorListQuery,
  ISafeClientError,
} from "../interfaces/client-error.interface";
import { ClientErrorModel } from "../models/client-error.model";
import { UserModel } from "../models/user.model";

// Best-effort diagnostic log, not user data — capped so one noisy client
// can't grow this collection (or the admin list payload) without bound.
const LIST_LIMIT = 200;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(query: IClientErrorListQuery): Record<string, any> {
  const filter: Record<string, any> = {};

  if (query.environment) filter.environment = query.environment;
  if (query.source) filter.source = query.source;

  if (query.search?.trim()) {
    const pattern = new RegExp(escapeRegExp(query.search.trim()), "i");
    filter.$or = [{ message: pattern }, { path: pattern }, { source: pattern }];
  }

  return filter;
}

function toSafeClientError(error: any, username: string | null): ISafeClientError {
  return {
    idClientError: error._id.toString(),
    idUser: error.idUser,
    username,
    source: error.source,
    environment: error.environment,
    message: error.message,
    stack: error.stack,
    path: error.path,
    userAgent: error.userAgent,
    extra: error.extra,
    isRead: error.isRead,
    createdAt: error.createdAt,
  };
}

export const ClientErrorService = {
  async create(idUser: string | null, input: ICreateClientErrorInput): Promise<ISafeClientError> {
    const error = await ClientErrorModel.create({ idUser, ...input });
    return toSafeClientError(error, null);
  },

  async list(query: IClientErrorListQuery): Promise<ISafeClientError[]> {
    const filter = buildFilter(query);

    const errors = await ClientErrorModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean();

    const idUsers = [
      ...new Set(errors.map((error) => error.idUser).filter((id): id is string => Boolean(id))),
    ];
    const users = idUsers.length
      ? await UserModel.find({ _id: { $in: idUsers } }, { username: 1 }).lean()
      : [];
    const usernameByIdUser = new Map(users.map((user) => [user._id.toString(), user.username]));

    // Snapshot isRead BEFORE flipping it, so this response still shows which
    // rows were unread as of this fetch — only the *next* fetch sees them as
    // read.
    const safeErrors = errors.map((error) =>
      toSafeClientError(error, usernameByIdUser.get(error.idUser ?? "") ?? null),
    );

    const unreadIds = errors.filter((error) => !error.isRead).map((error) => error._id);
    if (unreadIds.length > 0) {
      await ClientErrorModel.updateMany({ _id: { $in: unreadIds } }, { isRead: true });
    }

    return safeErrors;
  },

  async remove(idClientError: string): Promise<void> {
    const deleted = await ClientErrorModel.findByIdAndDelete(idClientError);
    if (!deleted) throw new Error("Error tidak ditemukan");
  },
};
