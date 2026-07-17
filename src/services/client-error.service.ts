import { ICreateClientErrorInput, ISafeClientError } from "../interfaces/client-error.interface";
import { ClientErrorModel } from "../models/client-error.model";

// Best-effort diagnostic log, not user data — capped so one noisy client
// can't grow this collection (or the admin list payload) without bound.
const LIST_LIMIT = 200;

const toSafeClientError = (error: any): ISafeClientError => ({
  idClientError: error._id.toString(),
  idUser: error.idUser,
  source: error.source,
  message: error.message,
  stack: error.stack,
  path: error.path,
  userAgent: error.userAgent,
  extra: error.extra,
  createdAt: error.createdAt,
});

export const ClientErrorService = {
  async create(idUser: string | null, input: ICreateClientErrorInput): Promise<ISafeClientError> {
    const error = await ClientErrorModel.create({ idUser, ...input });
    return toSafeClientError(error);
  },

  async list(): Promise<ISafeClientError[]> {
    const errors = await ClientErrorModel.find()
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean();
    return errors.map(toSafeClientError);
  },
};
