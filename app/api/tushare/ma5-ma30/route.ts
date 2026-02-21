import { NextRequest, NextResponse } from "next/server";
import { getMA5MA30 } from "@/lib/tushare";

/**
 * GET /api/tushare/ma5-ma30?code=xxxxxx
 *
 * 返回：ma5、ma30、latestTradeDate、near（5日线与30日线是否接近，阈值 2%）
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
    const result = await getMA5MA30(code);
    if (!result) {
      return NextResponse.json(
        { error: `未获取到 ${code} 的足够日线数据（需至少30个交易日）` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`GET /api/tushare/ma5-ma30 [${code}] error:`, error);
    return NextResponse.json(
      { error: error.message || "获取5日/30日均线失败" },
      { status: 500 }
    );
  }
}
