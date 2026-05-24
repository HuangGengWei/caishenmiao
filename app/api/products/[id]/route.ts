import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productUpdateSchema } from "@/lib/product-schema";

function serializeProduct(p: {
  id: number;
  sku: string | null;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  stock: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    stock: p.stock,
    imageUrl: p.imageUrl,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      return NextResponse.json({ error: "无效 ID" }, { status: 400 });
    }
    const row = await prisma.product.findUnique({ where: { id: numId } });
    if (!row) {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }
    return NextResponse.json(serializeProduct(row));
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json(
      { error: err.message ?? "获取商品失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      return NextResponse.json({ error: "无效 ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku?.trim() || null;
    if (data.name !== undefined) {
      const n = data.name.trim();
      if (!n) {
        return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
      }
      updateData.name = n;
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.price !== undefined) updateData.price = data.price;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl?.trim() || null;
    }
    if (data.active !== undefined) updateData.active = data.active;
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "无更新字段" }, { status: 400 });
    }
    const updated = await prisma.product.update({
      where: { id: numId },
      data: updateData as Prisma.ProductUpdateInput,
    });
    return NextResponse.json(serializeProduct(updated));
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error("PATCH /api/products/[id] error:", error);
    if (err.code === "P2025") {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "SKU 已存在" }, { status: 409 });
    }
    return NextResponse.json(
      { error: err.message ?? "更新商品失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      return NextResponse.json({ error: "无效 ID" }, { status: 400 });
    }
    await prisma.product.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error("DELETE /api/products/[id] error:", error);
    if (err.code === "P2025") {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err.message ?? "删除商品失败" },
      { status: 500 }
    );
  }
}
