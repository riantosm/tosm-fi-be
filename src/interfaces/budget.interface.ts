export interface IChildLimit {
  idCategory: string;
  idSubCategory: string | null;
  limitAmount: number;
}

export interface IBudget {
  idUser: string;
  name: string;
  color: string;
  // Empty array = applies to every expense category for this user.
  idCategories: string[];
  limitAmount: number;
  childLimits: IChildLimit[];
  // Shown on the Dashboard's budgets widget when true.
  isPinned: boolean;
  // Persists manual drag-to-reorder — lower sorts first.
  order: number;
}

export interface ICreateBudgetInput {
  name: string;
  color: string;
  idCategories: string[];
  limitAmount: number;
  isPinned?: boolean;
}

// All fields optional — update() applies a genuine partial patch (unlike
// category's full-replace update), since the frontend's "set a single row's
// limit" flow sends `{ childLimits }` alone and must not clobber the rest.
export interface IUpdateBudgetInput {
  name?: string;
  color?: string;
  idCategories?: string[];
  limitAmount?: number;
  childLimits?: IChildLimit[];
  isPinned?: boolean;
}

export interface ISafeChildLimit {
  idCategory: string;
  idSubCategory: string | null;
  limitAmount: number;
}

export interface ISafeBudget {
  idBudget: string;
  name: string;
  color: string;
  idCategories: string[];
  limitAmount: number;
  childLimits: ISafeChildLimit[];
  isPinned: boolean;
}
