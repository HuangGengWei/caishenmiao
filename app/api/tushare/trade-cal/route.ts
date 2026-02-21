import { NextRequest, NextResponse } from "next/server";
import { getTradeCal } from "@/lib/tushare";

/**
 * GET /api/tushare/trade-cal
 * 获取交易日历
 * 查询参数: startDate (YYYYMMDD), endDate (YYYYMMDD)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "缺少参数: startDate 和 endDate (格式: YYYYMMDD)" },
        { status: 400 }
      );
    }

    const data = await getTradeCal(startDate, endDate);

    // 返回非交易日列表（is_open === 0）
    const nonTradingDays = data
      .filter((item) => item.is_open === 0)
      .map((item) => {
        // 转换为 YYYY-MM-DD 格式
        const dateStr = item.cal_date;
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      });

    return NextResponse.json({ nonTradingDays });
  } catch (error: any) {
    console.error("GET /api/tushare/trade-cal error:", error);
    return NextResponse.json(
      { error: error.message || "获取交易日历失败" },
      { status: 500 }
    );
  }
}
