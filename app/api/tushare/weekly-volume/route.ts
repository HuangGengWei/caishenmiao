import { NextRequest, NextResponse } from "next/server";
import { analyzeWeeklyVolumePattern, WeeklyVolumePattern } from "@/lib/tushare";

/**
 * GET /api/tushare/weekly-volume?code=xxxxxx
 * 返回：{ hasPattern: boolean, patternStrength: number, description: string, ... }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "缺少参数 code" },
      { status: 400 }
    );
  }

  try {
    const pattern: WeeklyVolumePattern = await analyzeWeeklyVolumePattern(code);
    return NextResponse.json(pattern);
  } catch (error: any) {
    console.error(`GET /api/tushare/weekly-volume [${code}] error:`, error);
    return NextResponse.json(
      { error: error?.message || "获取周线数据失败" },
      { status: 500 }
    );
  }
}