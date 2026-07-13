import {
  ICreateCategoryInput,
  ICreateSubCategoryInput,
  ISafeCategory,
  ISafeSubCategory,
  IUpdateCategoryInput,
  IUpdateSubCategoryInput,
} from "../interfaces/category.interface";
import { CategoryModel } from "../models/category.model";

const toSafeSubCategory = (idCategory: string, sub: any): ISafeSubCategory => ({
  idSubCategory: sub._id.toString(),
  idCategory,
  nameSubCategory: sub.nameSubCategory,
  icon: sub.icon,
  transactionCount: sub.transactionCount,
});

const toSafeCategory = (category: any): ISafeCategory => {
  const idCategory = category._id.toString();
  return {
    idCategory,
    nameCategory: category.nameCategory,
    type: category.type,
    color: category.color,
    icon: category.icon,
    transactionCount: category.transactionCount,
    subCategories: [...category.subCategories]
      .sort((a, b) => a.order - b.order)
      .map((sub) => toSafeSubCategory(idCategory, sub)),
  };
};

async function findOwnedCategory(idUser: string, idCategory: string) {
  const category = await CategoryModel.findOne({ _id: idCategory, idUser });
  if (!category) throw new Error("Kategori tidak ditemukan");
  return category;
}

export const CategoryService = {
  async getList(idUser: string): Promise<ISafeCategory[]> {
    const categories = await CategoryModel.find({ idUser }).sort({ order: 1, createdAt: 1 }).lean();
    return categories.map(toSafeCategory);
  },

  async create(idUser: string, input: ICreateCategoryInput): Promise<ISafeCategory> {
    const order = await CategoryModel.countDocuments({ idUser });
    const category = await CategoryModel.create({
      idUser,
      nameCategory: input.nameCategory,
      type: input.type,
      color: input.color,
      icon: input.icon,
      order,
    });
    return toSafeCategory(category);
  },

  async update(
    idUser: string,
    idCategory: string,
    input: IUpdateCategoryInput
  ): Promise<ISafeCategory> {
    const category = await findOwnedCategory(idUser, idCategory);
    category.nameCategory = input.nameCategory;
    category.type = input.type;
    category.color = input.color;
    category.icon = input.icon;
    await category.save();
    return toSafeCategory(category);
  },

  async remove(idUser: string, idCategory: string): Promise<void> {
    const category = await CategoryModel.findOneAndDelete({ _id: idCategory, idUser });
    if (!category) throw new Error("Kategori tidak ditemukan");
  },

  async reorder(idUser: string, orderedIds: string[]): Promise<ISafeCategory[]> {
    await Promise.all(
      orderedIds.map((idCategory, order) =>
        CategoryModel.updateOne({ _id: idCategory, idUser }, { order })
      )
    );
    return CategoryService.getList(idUser);
  },

  async createSubCategory(
    idUser: string,
    idCategory: string,
    input: ICreateSubCategoryInput
  ): Promise<ISafeSubCategory> {
    const category = await findOwnedCategory(idUser, idCategory);
    const order = category.subCategories.length;
    category.subCategories.push({
      nameSubCategory: input.nameSubCategory,
      icon: input.icon,
      transactionCount: 0,
      order,
    });
    await category.save();
    const created = category.subCategories[category.subCategories.length - 1];
    return toSafeSubCategory(idCategory, created);
  },

  async updateSubCategory(
    idUser: string,
    idCategory: string,
    idSubCategory: string,
    input: IUpdateSubCategoryInput
  ): Promise<ISafeSubCategory> {
    const category = await findOwnedCategory(idUser, idCategory);
    const sub = category.subCategories.id(idSubCategory);
    if (!sub) throw new Error("Subkategori tidak ditemukan");

    sub.nameSubCategory = input.nameSubCategory;
    sub.icon = input.icon;
    await category.save();
    return toSafeSubCategory(idCategory, sub);
  },

  async removeSubCategory(idUser: string, idCategory: string, idSubCategory: string): Promise<void> {
    const category = await findOwnedCategory(idUser, idCategory);
    const sub = category.subCategories.id(idSubCategory);
    if (!sub) throw new Error("Subkategori tidak ditemukan");

    sub.deleteOne();
    await category.save();
  },

  async reorderSubCategories(
    idUser: string,
    idCategory: string,
    orderedIds: string[]
  ): Promise<ISafeSubCategory[]> {
    const category = await findOwnedCategory(idUser, idCategory);
    orderedIds.forEach((idSubCategory, order) => {
      const sub = category.subCategories.id(idSubCategory);
      if (sub) sub.order = order;
    });
    await category.save();
    return toSafeCategory(category).subCategories;
  },
};
