import express from "express";
import { CategoryController } from "../controllers/category.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, CategoryController.list);
router.post("/", requireAuth, requireActiveUser, CategoryController.create);
// Registered before "/:idCategory" so "reorder" isn't matched as an idCategory param.
router.patch("/reorder", requireAuth, requireActiveUser, CategoryController.reorder);

router.post(
  "/:idCategory/subcategories",
  requireAuth,
  requireActiveUser,
  CategoryController.createSubCategory
);
// Registered before "/:idCategory/subcategories/:idSubCategory" for the same reason.
router.patch(
  "/:idCategory/subcategories/reorder",
  requireAuth,
  requireActiveUser,
  CategoryController.reorderSubCategories
);
router.patch(
  "/:idCategory/subcategories/:idSubCategory",
  requireAuth,
  requireActiveUser,
  CategoryController.updateSubCategory
);
router.delete(
  "/:idCategory/subcategories/:idSubCategory",
  requireAuth,
  requireActiveUser,
  CategoryController.removeSubCategory
);

router.patch("/:idCategory", requireAuth, requireActiveUser, CategoryController.update);
router.delete("/:idCategory", requireAuth, requireActiveUser, CategoryController.remove);

export default router;
