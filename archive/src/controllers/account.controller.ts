import { Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { responseHandler } from "../utils/responseHandler";

export const AccountController = {
  async getAll(req: Request, res: Response) {
    try {
      const accounts = await AccountService.getAll();
      return responseHandler(res, {
        message: "Successfully fetched all accounts",
        data: accounts,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch accounts",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const account = await AccountService.getById(Number(req.params.id));
      if (!account)
        return responseHandler(res, {
          message: "Account not found",
          is_success: false,
          status: 404,
          data: {},
        });

      return responseHandler(res, {
        message: "Successfully fetched account",
        data: account,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch account",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body = req.body;
      const id_account = Math.floor(Date.now() / 1000);
      const newAccount = await AccountService.create({
        ...body,
        id_account,
      });

      return responseHandler(res, {
        message: "Account created successfully",
        data: newAccount,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to create account",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { id_account, ...safeBody } = req.body; // 🔒 Hilangkan id_account agar tidak bisa diubah

      const account = await AccountService.getById(id);
      if (!account)
        return responseHandler(res, {
          message: "Account not found",
          is_success: false,
          status: 404,
          data: {},
        });

      const updated = await AccountService.update(id, safeBody);
      return responseHandler(res, {
        message: "Account updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to update account",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await AccountService.delete(Number(req.params.id));
      console.log("deleted", deleted);
      if (!deleted)
        return responseHandler(res, {
          message: "Account not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Account deleted successfully",
        data: {},
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to delete account",
        is_success: false,
        status: 400,
        error,
      });
    }
  },
};
