import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { CategoryService } from "../services/category.service";
import { responseHandler } from "../utils/responseHandler";

export const CategoryController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const categories = await CategoryService.getList(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Berhasil mengambil daftar kategori",
        data: categories,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar kategori",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { nameCategory, type, color, icon } = req.body;

      if (!nameCategory || !type || !color || !icon) {
        return responseHandler(res, {
          message: "nameCategory, type, color, dan icon wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const category = await CategoryService.create(req.currentUser!.idUser, {
        nameCategory,
        type,
        color,
        icon,
      });

      return responseHandler(res, {
        message: "Kategori berhasil dibuat",
        data: category,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat kategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { nameCategory, type, color, icon } = req.body;

      if (!nameCategory || !type || !color || !icon) {
        return responseHandler(res, {
          message: "nameCategory, type, color, dan icon wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const category = await CategoryService.update(
        req.currentUser!.idUser,
        req.params.idCategory,
        { nameCategory, type, color, icon }
      );

      return responseHandler(res, {
        message: "Kategori berhasil diperbarui",
        data: category,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui kategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await CategoryService.remove(req.currentUser!.idUser, req.params.idCategory);
      return responseHandler(res, {
        message: "Kategori berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus kategori",
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

      const categories = await CategoryService.reorder(req.currentUser!.idUser, orderedIds);

      return responseHandler(res, {
        message: "Urutan kategori berhasil disimpan",
        data: categories,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menyimpan urutan kategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async createSubCategory(req: AuthRequest, res: Response) {
    try {
      const { nameSubCategory, icon } = req.body;

      if (!nameSubCategory || !icon) {
        return responseHandler(res, {
          message: "nameSubCategory dan icon wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const subCategory = await CategoryService.createSubCategory(
        req.currentUser!.idUser,
        req.params.idCategory,
        { nameSubCategory, icon }
      );

      return responseHandler(res, {
        message: "Subkategori berhasil dibuat",
        data: subCategory,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat subkategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async updateSubCategory(req: AuthRequest, res: Response) {
    try {
      const { nameSubCategory, icon } = req.body;

      if (!nameSubCategory || !icon) {
        return responseHandler(res, {
          message: "nameSubCategory dan icon wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const subCategory = await CategoryService.updateSubCategory(
        req.currentUser!.idUser,
        req.params.idCategory,
        req.params.idSubCategory,
        { nameSubCategory, icon }
      );

      return responseHandler(res, {
        message: "Subkategori berhasil diperbarui",
        data: subCategory,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui subkategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async removeSubCategory(req: AuthRequest, res: Response) {
    try {
      await CategoryService.removeSubCategory(
        req.currentUser!.idUser,
        req.params.idCategory,
        req.params.idSubCategory
      );

      return responseHandler(res, {
        message: "Subkategori berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus subkategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async reorderSubCategories(req: AuthRequest, res: Response) {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return responseHandler(res, {
          message: "orderedIds wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const subCategories = await CategoryService.reorderSubCategories(
        req.currentUser!.idUser,
        req.params.idCategory,
        orderedIds
      );

      return responseHandler(res, {
        message: "Urutan subkategori berhasil disimpan",
        data: subCategories,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menyimpan urutan subkategori",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
