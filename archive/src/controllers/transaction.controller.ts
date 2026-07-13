import { Request, Response } from "express";
import { TransactionService } from "../services/transaction.service";
import { responseHandler } from "../utils/responseHandler";

export const TransactionController = {
  async getAll(req: Request, res: Response) {
    try {
      const transactions = await TransactionService.getAll(req.query);
      return responseHandler(res, {
        message: "Successfully fetched all transactions",
        data: transactions,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch transactions",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const transaction = await TransactionService.getById(
        Number(req.params.id)
      );
      if (!transaction)
        return responseHandler(res, {
          message: "Transaction not found",
          is_success: false,
          status: 404,
          data: {},
        });

      return responseHandler(res, {
        message: "Successfully fetched transaction",
        data: transaction,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch transaction",
        is_success: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body = req.body;
      const id_transaction = Math.floor(Date.now() / 1000);
      const newTransaction = await TransactionService.create({
        ...body,
        id_transaction,
      });

      return responseHandler(res, {
        message: "Transaction created successfully",
        data: newTransaction,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to create transaction",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { id_transaction, ...safeBody } = req.body;

      const updated = await TransactionService.update(id, safeBody);

      return responseHandler(res, {
        message: "Transaction updated successfully",
        data: updated,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to update transaction",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { deletedCount } = await TransactionService.delete(
        Number(req.params.id)
      );
      if (deletedCount === 0) {
        return responseHandler(res, {
          message: "Transaction not found",
          is_success: false,
          status: 404,
          data: {},
        });
      }
      return responseHandler(res, {
        message: "Transaction(s) deleted successfully",
        data: {},
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to delete transaction(s)",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async reset(req: Request, res: Response) {
    try {
      const id_account = req.query.id_account
        ? Number(req.query.id_account)
        : undefined;

      const deletedCount = await TransactionService.resetTransactions(
        id_account
      );

      return responseHandler(res, {
        message: `Successfully deleted ${deletedCount} transaction(s)`,
        data: { deletedCount },
        status: 200,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to reset transactions",
        is_success: false,
        status: 500,
        data: { error: error.message },
      });
    }
  },

  async transfer(req: Request, res: Response) {
    try {
      const result = await TransactionService.transfer(req.body);
      return responseHandler(res, {
        message: "Transfer successful",
        data: result,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to transfer",
        is_success: false,
        status: 400,
        error: error.message || error,
      });
    }
  },

  async profit(req: Request, res: Response) {
    try {
      const { id_account, amount, date } = req.body;

      // Validasi input minimal
      if (!id_account || !amount || !date) {
        return responseHandler(res, {
          message: "Missing required fields: id_account, amount, date",
          is_success: false,
          status: 400,
          data: {},
        });
      }

      const transaction = await TransactionService.profit({
        id_account,
        amount,
        date,
      });

      return responseHandler(res, {
        message: "Profit transaction created successfully",
        data: transaction,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to create profit transaction",
        is_success: false,
        status: 400,
        error: error.message || error,
      });
    }
  },
};
