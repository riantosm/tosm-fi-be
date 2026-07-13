/**
 * Format number menjadi format ribuan dengan titik
 * @param value number - angka yang akan diformat
 * @param options.prefixRp boolean - apakah menambahkan 'Rp ' di depan
 * @returns string - hasil format, misal "Rp 1.000.000" atau "1.000.000"
 */
export function formatCurrency(
  value: number,
  options?: { prefixRp?: boolean }
): string {
  const formatted = value.toLocaleString("id-ID"); // gunakan format Indonesia: titik sebagai ribuan, koma sebagai desimal
  return options?.prefixRp ? `Rp ${formatted}` : formatted;
}
