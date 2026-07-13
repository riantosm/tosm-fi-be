import { Types } from "mongoose";

export type CategoryType = "income" | "expense";

export interface ISubCategory {
  nameSubCategory: string;
  icon: string;
  transactionCount: number;
  // Persists manual drag-to-reorder within the parent category.
  order: number;
}

export interface ICategory {
  idUser: string;
  nameCategory: string;
  type: CategoryType;
  color: string;
  icon: string;
  transactionCount: number;
  // Persists manual drag-to-reorder among a user's categories.
  order: number;
  // Typed as Mongoose's DocumentArray (not plain ISubCategory[]) so
  // `.id()`/`.push()` are available on hydrated documents.
  subCategories: Types.DocumentArray<ISubCategory>;
}

export interface ICreateCategoryInput {
  nameCategory: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface IUpdateCategoryInput {
  nameCategory: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface ICreateSubCategoryInput {
  nameSubCategory: string;
  icon: string;
}

export interface IUpdateSubCategoryInput {
  nameSubCategory: string;
  icon: string;
}

export interface ISafeSubCategory {
  idSubCategory: string;
  idCategory: string;
  nameSubCategory: string;
  icon: string;
  transactionCount: number;
}

export interface ISafeCategory {
  idCategory: string;
  nameCategory: string;
  type: CategoryType;
  color: string;
  icon: string;
  transactionCount: number;
  subCategories: ISafeSubCategory[];
}
