import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { responseHandler } from "../utils/responseHandler";

export const UserController = {
  async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;
      const user = await UserService.register({ name, email, password });

      return responseHandler(res, {
        message: "User registered successfully",
        data: user,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Failed to register user",
        is_success: false,
        status: 400,
        error,
      });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await UserService.login({ email, password });

      return responseHandler(res, {
        message: "Login successful",
        data: result,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Failed to login",
        is_success: false,
        status: 401,
        error,
      });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const users = await UserService.getAll();
      return responseHandler(res, {
        message: "Successfully fetched all users",
        data: users,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch users",
        is_success: false,
        status: 500,
        error,
      });
    }
  },
};
