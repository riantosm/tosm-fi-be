import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  AssistantService,
  sanitizeDrafts,
  sanitizeHistory,
  sanitizeLanguage,
} from "../services/assistant.service";
import { LlmError } from "../utils/llm";
import { responseHandler } from "../utils/responseHandler";
import { parseTzOffsetMinutes } from "../utils/timezone";

// The frontend maps 429 to "AI lagi sibuk / kuota penuh" and everything else
// to a connection error, so overload (503) is reported as 429 too: from the
// user's side both mean "try again in a moment".
function llmErrorResponse(error: LlmError): { status: number; message: string } {
  switch (error.kind) {
    case "config":
      return { status: 500, message: "Asisten AI belum dikonfigurasi" };
    case "quota":
      return { status: 429, message: "Kuota AI gratis sedang penuh, coba lagi sebentar" };
    default:
      return { status: 429, message: "AI sedang sibuk, coba lagi sebentar" };
  }
}

export const AssistantController = {
  async chat(req: AuthRequest, res: Response) {
    try {
      const { history, drafts, tzOffsetMinutes, language, hasPreview } = req.body ?? {};
      const cleanHistory = sanitizeHistory(history);
      if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].role !== "user") {
        return responseHandler(res, {
          message: "history wajib diisi dan diakhiri pesan user",
          isSuccess: false,
          status: 400,
        });
      }

      const reply = await AssistantService.chat(req.currentUser!.idUser, {
        history: cleanHistory,
        drafts: sanitizeDrafts(drafts),
        tzOffsetMinutes: parseTzOffsetMinutes(tzOffsetMinutes),
        language: sanitizeLanguage(language),
        hasPreview: hasPreview === true,
      });

      return responseHandler(res, { message: "Berhasil memproses pesan", data: reply });
    } catch (error: any) {
      if (error instanceof LlmError) {
        console.error("[assistant] LLM error:", error.message);
        const { status, message } = llmErrorResponse(error);
        return responseHandler(res, { message, isSuccess: false, status, error: message });
      }
      return responseHandler(res, {
        message: error.message || "Gagal memproses pesan",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async commit(req: AuthRequest, res: Response) {
    try {
      const { drafts, tzOffsetMinutes, language } = req.body ?? {};
      const cleanDrafts = sanitizeDrafts(drafts);
      if (cleanDrafts.length === 0) {
        return responseHandler(res, {
          message: "drafts wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const result = await AssistantService.commit(
        req.currentUser!.idUser,
        cleanDrafts,
        sanitizeLanguage(language),
        parseTzOffsetMinutes(tzOffsetMinutes)
      );

      return responseHandler(res, {
        message: "Transaksi berhasil disimpan",
        data: result,
        status: 201,
      });
    } catch (error: any) {
      const message = error.message || "Gagal menyimpan transaksi";
      // data.idDraft tells the frontend which preview row to mark.
      return responseHandler(res, {
        message,
        isSuccess: false,
        status: 400,
        data: { error: message, idDraft: error.idDraft ?? null },
      });
    }
  },
};
