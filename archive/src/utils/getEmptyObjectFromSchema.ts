import mongoose from "mongoose";

/**
 * Generate an empty object based on a Mongoose model's schema definition.
 * Example output:
 * {
 *   id_account: 0,
 *   name_account: "",
 *   id_account_type: 0
 * }
 */
export function getEmptyObjectFromSchema(model: mongoose.Model<any>) {
  const schemaObj = (model.schema as any).obj;
  const empty: Record<string, any> = {};

  for (const key in schemaObj) {
    const field = schemaObj[key];

    if (!field || !field.type) {
      empty[key] = null;
      continue;
    }

    switch (field.type) {
      case String:
        empty[key] = "";
        break;
      case Number:
        empty[key] = 0;
        break;
      case Boolean:
        empty[key] = false;
        break;
      case Array:
        empty[key] = [];
        break;
      case Object:
        empty[key] = {};
        break;
      default:
        empty[key] = null;
        break;
    }
  }

  return empty;
}
