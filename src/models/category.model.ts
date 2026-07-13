import mongoose, { Schema } from "mongoose";
import { ICategory, ISubCategory } from "../interfaces/category.interface";

const SubCategorySchema = new Schema<ISubCategory>({
  nameSubCategory: { type: String, required: true },
  icon: { type: String, required: true },
  transactionCount: { type: Number, default: 0 },
  order: { type: Number, default: 0 },
});

const CategorySchema = new Schema<ICategory>(
  {
    idUser: { type: String, required: true, index: true },
    nameCategory: { type: String, required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    color: { type: String, required: true },
    icon: { type: String, required: true },
    transactionCount: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    // Embedded, not a separate collection — a subcategory never exists
    // outside its parent, so deleting the category deletes them for free.
    subCategories: { type: [SubCategorySchema], default: [] },
  },
  { timestamps: true }
);

export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);
