import { Request, Response } from "express";
import { TransactionTypeService } from "../services/transactionType.service";
import { responseHandler } from "../utils/responseHandler";

export const TransactionTypeController = {
  async getAll(req: Request, res: Response) {
    try {
      const types = await TransactionTypeService.getAll();
      return responseHandler(res, {
        message: "Successfully fetched all transaction types",
        data: types,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch transaction types",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const type = await TransactionTypeService.getById(id);
      if (!type)
        return responseHandler(res, {
          message: "Transaction type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Successfully fetched transaction type",
        data: type,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch transaction type",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const id_transaction_type = Math.floor(Date.now() / 1000);
      const newType = await TransactionTypeService.create({
        ...req.body,
        // id_transaction_type,
      });

      return responseHandler(res, {
        message: "Transaction type created successfully",
        data: newType,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to create transaction type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const updated = await TransactionTypeService.update(id, req.body);

      if (!updated)
        return responseHandler(res, {
          message: "Transaction type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Transaction type updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to update transaction type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const deleted = await TransactionTypeService.delete(id);
      if (!deleted)
        return responseHandler(res, {
          message: "Transaction type not found",
          is_success: false,
          status: 404,
        });

      return responseHandler(res, {
        message: "Transaction type deleted successfully",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to delete transaction type",
        is_success: false,
        status: 400,
        error,
      });
    }
  },
};
