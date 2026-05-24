import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productCreateSchema } from "@/lib/product-schema";

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

export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(rows.map(serializeProduct));
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: err.message ?? "获取商品列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const created = await prisma.product.create({
      data: {
        sku: data.sku?.trim() || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl?.trim() || null,
        active: data.active ?? true,
      },
    });
    return NextResponse.json(serializeProduct(created), { status: 201 });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error("POST /api/products error:", error);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "SKU 已存在" }, { status: 409 });
    }
    return NextResponse.json(
      { error: err.message ?? "创建商品失败" },
      { status: 500 }
    );
  }
}
