import bcrypt from "bcrypt";
import { IChangePasswordInput, ISafeUser, IUpdateProfileInput } from "../interfaces/user.interface";
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

  async updateProfile(idUser: string, input: IUpdateProfileInput): Promise<ISafeUser> {
    const nameUser = input.nameUser?.trim();
    const username = input.username?.trim();
    if (!nameUser) throw new Error("Nama wajib diisi");
    if (!username) throw new Error("Username wajib diisi");

    const user = await UserModel.findById(idUser);
    if (!user) throw new Error("User tidak ditemukan");

    if (username !== user.username) {
      const existing = await UserModel.findOne({ username, _id: { $ne: idUser } });
      if (existing) throw new Error("Username sudah digunakan");
    }

    user.nameUser = nameUser;
    user.username = username;
    await user.save();

    return toSafeUser(user);
  },

  // Requires the current password (unlike updateProfile) since a password
  // change is security-sensitive. Stamps tokenValidAfter the same way
  // AuthService.logout() does — every token issued before now, including
  // the one used to make this very request, is rejected afterward, forcing
  // a fresh login with the new password. Simpler and safer than trying to
  // seamlessly reissue a token for the current session, which would risk a
  // same-second race against this exact tokenValidAfter timestamp in
  // requireActiveUser's iat comparison.
  async changePassword(idUser: string, input: IChangePasswordInput): Promise<void> {
    const newPassword = input.newPassword ?? "";
    if (newPassword.length < 6) throw new Error("Password baru minimal 6 karakter");

    const user = await UserModel.findById(idUser);
    if (!user) throw new Error("User tidak ditemukan");

    const isValid = await bcrypt.compare(input.currentPassword ?? "", user.password);
    if (!isValid) throw new Error("Password lama salah");

    user.password = await bcrypt.hash(newPassword, 10);
    user.tokenValidAfter = new Date();
    await user.save();
  },
};
