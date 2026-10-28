import bcrypt from "bcrypt";
import {
  ILoginInput,
  IRegisterInput,
  ISafeUser,
} from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";
import { signToken } from "../utils/jwt";
import { toSafeUser } from "../utils/plan";

export const AuthService = {
  async register(data: IRegisterInput): Promise<ISafeUser> {
    const existing = await UserModel.findOne({ username: data.username });
    if (existing) throw new Error("Username sudah terdaftar");

    // Bootstrap: the very first account becomes the admin, who can later
    // give other accounts Pro. Every account is active right away.
    const isFirstUser = (await UserModel.countDocuments()) === 0;
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await UserModel.create({
      nameUser: data.nameUser,
      username: data.username,
      password: hashedPassword,
      role: isFirstUser ? "admin" : "user",
      status: "active",
      plan: "free",
    });

    return toSafeUser(user);
  },

  async login(data: ILoginInput): Promise<{ token: string; user: ISafeUser }> {
    const user = await UserModel.findOne({ username: data.username });
    if (!user) throw new Error("Username atau password salah");

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) throw new Error("Username atau password salah");

    // Accounts registered while approval was still required are activated
    // on their next login.
    if (user.status !== "active") {
      user.status = "active";
      await user.save();
    }

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
