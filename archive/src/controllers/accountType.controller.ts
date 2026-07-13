import { Request, Response } from "express";
import { AccountTypeService } from "../services/accountType.service";
import { responseHandler } from "../utils/responseHandler";

export const AccountTypeController = {
  async getAll(req: Request, res: Response) {
    try {
      const types = await AccountTypeService.getAll();
      return responseHandler(res, {
        message: "Successfully fetched all account types",
        data: types,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch account types",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const type = await AccountTypeService.getById(id);
      if (!type)
        return responseHandler(res, {
          message: "Account type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Successfully fetched account type",
        data: type,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch account type",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const id_account_type = Math.floor(Date.now() / 1000);
      const newType = await AccountTypeService.create({
        ...req.body,
        id_account_type,
      });

      return responseHandler(res, {
        message: "Account type created successfully",
        data: newType,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to create account type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await AccountTypeService.update(id, req.body);

      if (!updated)
        return responseHandler(res, {
          message: "Account type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Account type updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to update account type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const deleted = await AccountTypeService.delete(id);
      if (!deleted)
        return responseHandler(res, {
          message: "Account type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Account type deleted successfully",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to delete account type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },
};
