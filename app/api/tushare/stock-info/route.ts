import { NextRequest, NextResponse } from "next/server";
import { getStockInfo } from "@/lib/tushare";

/**
 * GET /api/tushare/stock-info
 * 根据股票代码获取股票信息
 * 查询参数: code (6位股票代码), tradeDate (可选, YYYYMMDD)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const tradeDate = searchParams.get("tradeDate");

    if (!code) {
      return NextResponse.json(
        { error: "缺少参数: code (6位股票代码)" },
        { status: 400 }
      );
    }

    // 转换日期格式：YYYY-MM-DD -> YYYYMMDD
    const formattedDate = tradeDate
      ? tradeDate.replace(/-/g, "")
      : undefined;

    const info = await getStockInfo(code, formattedDate);

    if (!info) {
      return NextResponse.json(
        { error: "未找到股票信息，请检查代码是否正确" },
        { status: 404 }
      );
    }

    return NextResponse.json(info);
  } catch (error: any) {
    console.error("GET /api/tushare/stock-info error:", error);
    return NextResponse.json(
      { error: error.message || "获取股票信息失败" },
      { status: 500 }
    );
  }
}
