import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { BudgetService } from "../services/budget.service";
import { responseHandler } from "../utils/responseHandler";

export const BudgetController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const budgets = await BudgetService.getList(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Berhasil mengambil daftar anggaran",
        data: budgets,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar anggaran",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { name, color, idCategories, limitAmount, isPinned } = req.body;

      if (!name || !color || limitAmount === undefined || limitAmount === null) {
        return responseHandler(res, {
          message: "name, color, dan limitAmount wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      if (idCategories !== undefined && !Array.isArray(idCategories)) {
        return responseHandler(res, {
          message: "idCategories harus berupa array",
          isSuccess: false,
          status: 400,
        });
      }

      const budget = await BudgetService.create(req.currentUser!.idUser, {
        name,
        color,
        idCategories: idCategories ?? [],
        limitAmount,
        isPinned,
      });

      return responseHandler(res, {
        message: "Anggaran berhasil dibuat",
        data: budget,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat anggaran",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { name, color, idCategories, limitAmount, childLimits, isPinned } = req.body;

      if (childLimits !== undefined && !Array.isArray(childLimits)) {
        return responseHandler(res, {
          message: "childLimits harus berupa array",
          isSuccess: false,
          status: 400,
        });
      }

      if (idCategories !== undefined && !Array.isArray(idCategories)) {
        return responseHandler(res, {
          message: "idCategories harus berupa array",
          isSuccess: false,
          status: 400,
        });
      }

      const budget = await BudgetService.update(req.currentUser!.idUser, req.params.idBudget, {
        name,
        color,
        idCategories,
        limitAmount,
        childLimits,
        isPinned,
      });

      return responseHandler(res, {
        message: "Anggaran berhasil diperbarui",
        data: budget,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui anggaran",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await BudgetService.remove(req.currentUser!.idUser, req.params.idBudget);
      return responseHandler(res, {
        message: "Anggaran berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus anggaran",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async reorder(req: AuthRequest, res: Response) {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return responseHandler(res, {
          message: "orderedIds wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const budgets = await BudgetService.reorder(req.currentUser!.idUser, orderedIds);

      return responseHandler(res, {
        message: "Urutan anggaran berhasil disimpan",
        data: budgets,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menyimpan urutan anggaran",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
