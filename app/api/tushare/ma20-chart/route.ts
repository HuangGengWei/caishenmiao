import { NextRequest, NextResponse } from "next/server";
import { getMA20WithOhlc } from "@/lib/tushare";

/**
 * GET /api/tushare/ma20-chart?code=xxxxxx
 * 返回 MA20 状态 + 近30个交易日 OHLC（用于蜡烛图）
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
    const result = await getMA20WithOhlc(code);
    if (!result) {
      return NextResponse.json(
        { error: `未获取到 ${code} 的数据或日线不足` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`GET /api/tushare/ma20-chart [${code}] error:`, error);
    return NextResponse.json(
      { error: error.message || "获取20日均线图表失败" },
      { status: 500 }
    );
  }
}
