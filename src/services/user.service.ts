import { ISafeUser } from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";

const toSafeUser = (user: any): ISafeUser => ({
  idUser: user._id.toString(),
  nameUser: user.nameUser,
  username: user.username,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

export const UserService = {
  async getList(): Promise<ISafeUser[]> {
    const users = await UserModel.find().sort({ createdAt: -1 }).lean();
    return users.map(toSafeUser);
  },

  async acceptUser(idUser: string): Promise<ISafeUser> {
    const user = await UserModel.findById(idUser);
    if (!user) throw new Error("User tidak ditemukan");

    user.status = "active";
    await user.save();

    return toSafeUser(user);
  },
};
