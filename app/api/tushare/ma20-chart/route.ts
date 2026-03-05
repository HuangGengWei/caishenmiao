import { NextRequest, NextResponse } from "next/server";
import { getMA20WithOhlc, getMA20WithOhlcAroundRecord } from "@/lib/tushare";

/**
 * GET /api/tushare/ma20-chart?code=xxxxxx&recordDate=YYYY-MM-DD
 * recordDate 可选；若传则返回以录入日为基准的 OHLC（便于图中标注录入日与涨停日）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const recordDate = searchParams.get("recordDate");

  if (!code) {
    return NextResponse.json(
      { error: "缺少参数 code（6位股票代码）" },
      { status: 400 }
    );
  }

  try {
    const result = recordDate
      ? await getMA20WithOhlcAroundRecord(code, recordDate)
      : await getMA20WithOhlc(code);
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
