import bcrypt from "bcrypt";
import {
  ILoginInput,
  IRegisterInput,
  IUser,
} from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";
import { signToken } from "../utils/jwt";

const toSafeUser = (user: IUser) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

export const UserService = {
  async register(data: IRegisterInput) {
    const existing = await UserModel.findOne({ email: data.email });
    if (existing) throw new Error("Email already registered");

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const id_user = Math.floor(Date.now() / 1000);

    const user = await UserModel.create({
      id_user,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: "user",
    });

    return toSafeUser(user.toObject());
  },

  async login(data: ILoginInput) {
    const user = await UserModel.findOne({ email: data.email }).lean();
    if (!user) throw new Error("Invalid email or password");

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) throw new Error("Invalid email or password");

    const token = signToken({ id_user: user.id_user, role: user.role });

    return { token, user: toSafeUser(user) };
  },

  async getAll() {
    const users = await UserModel.find().lean();
    return users.map(toSafeUser);
  },
};
