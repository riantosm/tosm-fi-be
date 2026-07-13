export interface IWallet {
  idUser: string;
  nameWallet: string;
  color: string;
  balance: number;
  transactionCount: number;
  isPrimary: boolean;
  // Persists manual drag-to-reorder — lower sorts first.
  order: number;
}

export interface ICreateWalletInput {
  nameWallet: string;
  color: string;
  balance?: number;
}

export interface IUpdateWalletInput {
  nameWallet: string;
  color: string;
}

export interface ISafeWallet {
  idWallet: string;
  nameWallet: string;
  color: string;
  balance: number;
  transactionCount: number;
  isPrimary: boolean;
}
