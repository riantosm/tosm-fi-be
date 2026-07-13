import bcrypt from "bcrypt";
import {
  ILoginInput,
  IRegisterInput,
  ISafeUser,
} from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";
import { signToken } from "../utils/jwt";

const toSafeUser = (user: any): ISafeUser => ({
  idUser: user._id.toString(),
  nameUser: user.nameUser,
  username: user.username,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

export const AuthService = {
  async register(data: IRegisterInput): Promise<ISafeUser> {
    const existing = await UserModel.findOne({ username: data.username });
    if (existing) throw new Error("Username sudah terdaftar");

    // Bootstrap: the very first account becomes an active admin so there is
    // always someone able to approve everyone who registers afterward.
    const isFirstUser = (await UserModel.countDocuments()) === 0;
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await UserModel.create({
      nameUser: data.nameUser,
      username: data.username,
      password: hashedPassword,
      role: isFirstUser ? "admin" : "user",
      status: isFirstUser ? "active" : "pending",
    });

    return toSafeUser(user);
  },

  async login(data: ILoginInput): Promise<{ token: string; user: ISafeUser }> {
    const user = await UserModel.findOne({ username: data.username });
    if (!user) throw new Error("Username atau password salah");

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) throw new Error("Username atau password salah");

    // Login succeeds even while pending — /user/me and other protected
    // routes are what actually block a not-yet-approved user.
    const token = signToken({ idUser: user._id.toString(), role: user.role });

    return { token, user: toSafeUser(user) };
  },

  async logout(idUser: string): Promise<void> {
    // Invalidates every token issued up to now for this user — including
    // ones held by other tabs/devices — since we don't track individual
    // sessions.
    await UserModel.findByIdAndUpdate(idUser, { tokenValidAfter: new Date() });
  },
};
