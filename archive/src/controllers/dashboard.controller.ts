import { Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";
import { responseHandler } from "../utils/responseHandler";

export const DashboardController = {
  async get(req: Request, res: Response) {
    try {
      const data = await DashboardService.getDashboard(req.query);
      return responseHandler(res, {
        message: "Successfully fetched dashboard data",
        data,
        status: 200,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch dashboard data",
        is_success: false,
        status: 500,
        data: { error: error.message },
      });
    }
  },

  async getLineChart(req: Request, res: Response) {
    try {
      const data = await DashboardService.getLineChart(req.query);
      return responseHandler(res, {
        message: "Successfully fetched line chart data",
        data,
        status: 200,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch line chart data",
        is_success: false,
        status: 500,
        data: { error: error.message },
      });
    }
  },

  async getComparedLineChart(req: Request, res: Response) {
    try {
      const data = await DashboardService.getComparedLineChart(req.query);
      return responseHandler(res, {
        message: "Successfully fetched line chart data",
        data,
        status: 200,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Failed to fetch line chart data",
        is_success: false,
        status: 500,
        data: { error: error.message },
      });
    }
  },
};

// [
//   {
//     "date_formated": "1 Oktober 2026",
//     "date": 1788303600,
//     "amount": 94754558
//   },
//   {
//     "date_formated": "1 September 2026",
//     "date": 1785625200,
//     "amount": 89254558
//   },
//   {
//     "date_formated": "1 Agustus 2026",
//     "date": 1783033200,
//     "amount": 83754558
//   },
//   {
//     "date_formated": "1 Juli 2026",
//     "date": 1780354800,
//     "amount": 78254558
//   },
//   {
//     "date_formated": "1 Juni 2026",
//     "date": 1777676400,
//     "amount": 72754558
//   },
//   {
//     "date_formated": "1 Mei 2026",
//     "date": 1775084400,
//     "amount": 67254558
//   },
//   {
//     "date_formated": "1 April 2026",
//     "date": 1772406000,
//     "amount": 61754558
//   },
//   {
//     "date_formated": "1 Maret 2026",
//     "date": 1769814000,
//     "amount": 56254558
//   },
//   {
//     "date_formated": "1 Februari 2026",
//     "date": 1767135600,
//     "amount": 50754558
//   },
//   {
//     "date_formated": "1 Januari 2026",
//     "date": 1764716400,
//     "amount": 45254558
//   },
//   {
//     "date_formated": "1 Desember 2025",
//     "date": 1762041600,
//     "amount": 39754558
//   },
//   {
//     "date_formated": "1 November 2025",
//     "date": 1759449600,
//     "amount": 34254558
//   },
//   {
//     "date_formated": "1 Oktober 2025",
//     "date": 1759276800,
//     "amount": 28754558
//   },
//   {
//     "date_formated": "1 September 2025",
//     "date": 1756684800,
//     "amount": 7900000
//   },
//   {
//     "date_formated": "1 Agustus 2025",
//     "date": 1754006400,
//     "amount": 10000000
//   },
//   {
//     "date_formated": "1 Juli 2025",
//     "date": 1751328000,
//     "amount": 7600000
//   },
//   {
//     "date_formated": "1 Juni 2025",
//     "date": 1748736000,
//     "amount": 6200000
//   },
//   {
//     "date_formated": "1 Mei 2025",
//     "date": 1746057600,
//     "amount": 9900000
//   },
//   {
//     "date_formated": "1 April 2025",
//     "date": 1743465600,
//     "amount": 11000000
//   },
//   {
//     "date_formated": "1 Maret 2025",
//     "date": 1740787200,
//     "amount": 18000000
//   },
//   {
//     "date_formated": "1 Februari 2025",
//     "date": 1738368000,
//     "amount": 7100000
//   },
//   {
//     "date_formated": "1 Januari 2025",
//     "date": 1735689600,
//     "amount": 2900000
//   }
// ]
