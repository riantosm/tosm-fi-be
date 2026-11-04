export interface IWallet {
  idUser: string;
  nameWallet: string;
  color: string;
  balance: number;
  transactionCount: number;
  isPrimary: boolean;
  // Persists manual drag-to-reorder — lower sorts first.
  order: number;
  // Uploaded logo (Cloudinary, tosm-fi/wallet/<idWallet>). null = clients show the default wallet icon.
  logoUrl: string | null;
  logoPublicId: string | null;
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
  logoUrl: string | null;
}
