import { NextRequest, NextResponse } from "next/server";
import { getFirstLimitUpSince, getLimitUpDatesAround } from "@/lib/tushare";

/**
 * GET /api/tushare/limit-up?code=xxxxxx&recordDate=YYYY-MM-DD&extended=1
 * 返回：{ limitUpDate: string | null, limitUpDates?: string[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const recordDate = searchParams.get("recordDate");
  const extended = searchParams.get("extended") === "1";

  if (!code || !recordDate) {
    return NextResponse.json(
      { error: "缺少参数 code 或 recordDate" },
      { status: 400 }
    );
  }

  try {
    const limitUpDate = await getFirstLimitUpSince(code, recordDate);
    const result: { limitUpDate: string | null; limitUpDates?: string[] } = { limitUpDate };
    if (extended) {
      const limitUpDates = await getLimitUpDatesAround(code, recordDate);
      result.limitUpDates = limitUpDates;
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(
      `GET /api/tushare/limit-up [${code} ${recordDate}] error:`,
      error
    );
    return NextResponse.json(
      { error: error?.message || "获取涨停数据失败" },
      { status: 500 }
    );
  }
}

