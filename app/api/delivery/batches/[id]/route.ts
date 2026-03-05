import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE: 删除单个批次（及其下所有记录）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawId = (await params).id;
    const id = rawId === "0" ? 0 : parseInt(rawId, 10);
    if (rawId === "0") {
      await prisma.deliveryRecord.deleteMany({ where: { batchId: null } });
    } else if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "无效的批次 ID" }, { status: 400 });
    } else {
      await prisma.deliveryRecord.deleteMany({ where: { batchId: id } });
      await prisma.deliveryBatch.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/delivery/batches/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "删除失败" },
      { status: 500 }
    );
  }
}
