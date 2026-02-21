import { NextRequest, NextResponse } from "next/server";
import { getDailyChartData } from "@/lib/tushare";

/**
 * GET /api/tushare/daily-chart?code=xxxxxx
 * 返回近30个交易日收盘价/MA5/MA30、near（5日与30日线是否接近）、typicalNearMa30（当日均价与30日线是否接近）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "缺少参数 code（6位股票代码）" },
      { status: 400 }
    );
  }

  try {
    const result = await getDailyChartData(code);
    if (!result) {
      return NextResponse.json(
        { error: `未获取到 ${code} 的足够日线数据（需至少30个交易日）` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`GET /api/tushare/daily-chart [${code}] error:`, error);
    return NextResponse.json(
      { error: error.message || "获取行情图表失败" },
      { status: 500 }
    );
  }
}
