import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SectorScreenshot } from "@/lib/types";

// GET: 获取截图（支持按日期筛选）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const sector = searchParams.get("sector");

    const where: any = {};
    if (date) {
      where.date = new Date(date);
    }
    if (sector) {
      where.sector = sector;
    }

    const screenshots = await prisma.sectorScreenshot.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const formatted: SectorScreenshot[] = screenshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      sector: s.sector,
      imageDataUrl: s.imageData,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/sector-screenshots error:", error);
    return NextResponse.json(
      { error: error.message || "获取截图失败" },
      { status: 500 }
    );
  }
}

// POST: 上传/更新截图
export async function POST(req: NextRequest) {
  try {
    const body: SectorScreenshot = await req.json();

    if (!body.date || !body.sector || !body.imageDataUrl) {
      return NextResponse.json({ error: "数据格式错误" }, { status: 400 });
    }

    // 先尝试查找是否存在
    const existing = await prisma.sectorScreenshot.findFirst({
      where: {
        date: new Date(body.date),
        sector: body.sector,
      },
    });

    if (existing) {
      await prisma.sectorScreenshot.update({
        where: { id: existing.id },
        data: { imageData: body.imageDataUrl },
      });
    } else {
      await prisma.sectorScreenshot.create({
        data: {
          date: new Date(body.date),
          sector: body.sector,
          imageData: body.imageDataUrl,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/sector-screenshots error:", error);
    return NextResponse.json(
      { error: error.message || "保存截图失败" },
      { status: 500 }
    );
  }
}
