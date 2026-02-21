import { NextRequest, NextResponse } from "next/server";
import { getMA20 } from "@/lib/tushare";

/**
 * GET /api/tushare/ma20?code=xxxxxx
 *
 * 返回字段：
 *   ma20            - 20日均线（最新20个交易日收盘价均值）
 *   latestClose     - 最新交易日收盘价
 *   latestHigh      - 最新交易日最高价
 *   latestTradeDate - 数据所属的最新交易日（YYYY-MM-DD）
 *   status          - "above" | "touched" | "below"
 *     above   : 收盘价 >= MA20（已上穿/站上均线）
 *     touched : 最高价 >= MA20 但收盘价 < MA20（日内触及但未收上）
 *     below   : 最高价也 < MA20（未达到）
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
    const result = await getMA20(code);
    if (!result) {
      return NextResponse.json(
        { error: `未获取到 ${code} 的数据` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`GET /api/tushare/ma20 [${code}] error:`, error);
    // 将 getMA20 抛出的业务错误直接透传给前端
    return NextResponse.json(
      { error: error.message || "获取20日均线失败" },
      { status: 500 }
    );
  }
}
