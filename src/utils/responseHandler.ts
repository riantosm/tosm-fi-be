import { Response } from "express";

interface IApiResponse {
  message: string;
  data?: any;
  isSuccess?: boolean;
  status?: number;
  error?: any;
}

export const responseHandler = (
  res: Response,
  { message, data = {}, isSuccess = true, status = 200, error }: IApiResponse
) => {
  // Jika ada error, bungkus di dalam data.error
  const responseData =
    !isSuccess && error
      ? { error: typeof error === "string" ? error : error.message || String(error) }
      : data || {};

  // Jika data berupa array kosong, jadikan []
  const normalizedData =
    Array.isArray(responseData) && responseData.length === 0
      ? []
      : responseData;

  return res.status(status).json({
    message,
    data: normalizedData,
    isSuccess,
    status,
  });
};
