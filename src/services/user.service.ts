import bcrypt from "bcrypt";
import { IChangePasswordInput, ISafeUser, IUpdateProfileInput, UserPlan } from "../interfaces/user.interface";
import { BudgetModel } from "../models/budget.model";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { ScheduleModel } from "../models/schedule.model";
import { UserModel } from "../models/user.model";
import { WalletModel } from "../models/wallet.model";
import { isDemoUsername } from "../utils/demo";
import {
  effectivePlan,
  IPlanLimits,
  localMonthKey,
  PLAN_LIMITS,
  PlanLimitError,
  PRO_LIFETIME_PRICE,
  toSafeUser,
} from "../utils/plan";

export interface IPlanInfo {
  plan: UserPlan;
  proSince: Date | null;
  limits: IPlanLimits;
  usage: {
    wallets: number;
    categories: number;
    budgets: number;
    schedules: number;
    instruments: number;
    aiMessages: number;
  };
  proLifetimePrice: number;
}

export const UserService = {
  async getList(): Promise<ISafeUser[]> {
    const users = await UserModel.find().sort({ createdAt: -1 }).lean();
    return users.map(toSafeUser);
  },

  async getPlanInfo(idUser: string, tzOffsetMinutes: number): Promise<IPlanInfo> {
    const user = await UserModel.findById(idUser).lean();
    if (!user) throw new Error("User tidak ditemukan");
    const plan = effectivePlan(user);

    const [wallets, categories, budgets, schedules, instruments] = await Promise.all([
      WalletModel.countDocuments({ idUser }),
      CategoryModel.countDocuments({ idUser }),
      BudgetModel.countDocuments({ idUser }),
      ScheduleModel.countDocuments({ idUser }),
      InstrumentModel.countDocuments({ idUser }),
    ]);
    const aiMessages = user.aiUsageMonth === localMonthKey(tzOffsetMinutes) ? user.aiUsageCount ?? 0 : 0;

    return {
      plan,
      proSince: user.proSince ?? null,
      limits: PLAN_LIMITS[plan],
      usage: { wallets, categories, budgets, schedules, instruments, aiMessages },
      proLifetimePrice: PRO_LIFETIME_PRICE,
    };
  },

  /**
   * Counts one Catat Cepat message that is about to reach the LLM, atomically
   * against this month's quota. Throws PlanLimitError once it is used up.
   * Admins are not metered.
   */
  async consumeAiMessage(user: ISafeUser, tzOffsetMinutes: number): Promise<boolean> {
    if (user.role === "admin") return false;
    const limit = PLAN_LIMITS[user.plan].aiMessagesPerMonth;
    if (limit === null) return false;

    const month = localMonthKey(tzOffsetMinutes);
    await UserModel.updateOne(
      { _id: user.idUser, aiUsageMonth: { $ne: month } },
      { aiUsageMonth: month, aiUsageCount: 0 }
    );
    const updated = await UserModel.findOneAndUpdate(
      { _id: user.idUser, aiUsageMonth: month, aiUsageCount: { $lt: limit } },
      { $inc: { aiUsageCount: 1 } }
    );
    if (!updated) {
      throw new PlanLimitError(
        "aiMessages",
        user.plan === "pro"
          ? `Kuota Catat Cepat bulan ini (${limit} pesan) sudah habis.`
          : `Kuota Catat Cepat paket Free (${limit} pesan/bulan) sudah habis. Upgrade ke Pro untuk ${PLAN_LIMITS.pro.aiMessagesPerMonth} pesan/bulan.`,
        limit
      );
    }
    return true;
  },

  /** Gives back a message consumed for an LLM call that then failed. */
  async refundAiMessage(idUser: string, tzOffsetMinutes: number): Promise<void> {
    await UserModel.updateOne(
      { _id: idUser, aiUsageMonth: localMonthKey(tzOffsetMinutes), aiUsageCount: { $gt: 0 } },
      { $inc: { aiUsageCount: -1 } }
    );
  },

  // Admin-only: grant Pro for free (or take it back). Admins are always Pro.
  async setPlan(idUser: string, plan: UserPlan): Promise<ISafeUser> {
    const user = await UserModel.findById(idUser);
    if (!user) throw new Error("User tidak ditemukan");
    if (user.role === "admin") throw new Error("Admin selalu Pro");

    user.plan = plan;
    user.proSince = plan === "pro" ? user.proSince ?? new Date() : null;
    user.proSource = plan === "pro" ? user.proSource ?? "admin" : null;
    await user.save();

    return toSafeUser(user);
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
      if (isDemoUsername(user.username)) throw new Error("Username akun demo tidak bisa diubah");
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
