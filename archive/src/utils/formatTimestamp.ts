import moment from "moment";
// @ts-ignore
// import "moment/locale/id";

// moment.locale("id"); // Set locale Indonesia

/**
 * Mengubah timestamp menjadi format "25 Januari 2025"
 * @param timestamp number (10-digit atau 13-digit)
 * @returns string formatted date
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "";

  // jika timestamp 10 digit (detik), dikali 1000 menjadi milidetik
  const ts = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;

  return moment(ts).format("D MMMM YYYY");
}
