import { z } from "zod";

export const productCreateSchema = z.object({
  sku: z.string().max(64).optional().nullable(),
  name: z.string().min(1, "名称不能为空").max(255),
  description: z.string().optional().nullable(),
  price: z.coerce.number().nonnegative("价格不能为负"),
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z
    .string()
    .max(512)
    .optional()
    .nullable()
    .transform((s) => (s === "" ? null : s)),
  active: z.boolean().optional().default(true),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
