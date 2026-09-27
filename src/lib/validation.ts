import { z } from "zod";

export const phoneRegex = /^628\d{7,12}$/;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
  password: z.string().min(8, "Minimal 8 karakter").max(72),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .pipe(z.string().regex(phoneRegex, "Format: 628xxxxxxxxxx (nomor WhatsApp aktif)")),
  inviteCode: z.string().trim().max(40).optional(),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(80),
  category: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .default("sayur"),
  unit: z.enum(["kg", "ikat", "buah", "pack"]).default("kg"),
  description: z.string().trim().max(500).optional(),
  photoUrl: z.url("URL foto tidak valid").max(2048).optional().or(z.literal("")),
  basePrice: z.coerce
    .number()
    .int("Harga harus bilangan bulat")
    .min(100, "Harga minimal Rp100")
    .max(100_000_000),
});

export const harvestInputSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  quantity: z.coerce
    .number()
    .positive("Jumlah harus lebih dari 0")
    .max(100_000),
  quality: z.enum(["A", "B", "C"]).default("A"),
  note: z.string().trim().max(200).optional(),
});

export const orderInputSchema = z.object({
  buyerName: z.string().trim().min(1, "Nama wajib diisi").max(80),
  buyerPhone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .pipe(z.string().regex(phoneRegex, "Format: 628xxxxxxxxxx (nomor WhatsApp aktif)")),
  note: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive("Jumlah harus lebih dari 0").max(1_000),
      }),
    )
    .min(1, "Pilih minimal satu produk")
    .max(20),
});

export const feedbackInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(1, "Pesan wajib diisi").max(1_000),
});

export const kwtRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama kelompok minimal 3 karakter")
    .max(100),
  regency: z.string().trim().min(1, "Kabupaten/kota wajib diisi").max(80),
  province: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
});

export type KwtRegistrationInput = z.infer<typeof kwtRegistrationSchema>;

export type ProductInput = z.infer<typeof productInputSchema>;
export type HarvestInput = z.infer<typeof harvestInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

/** Ubah "08123456789" / "+62 812-3456-789" menjadi "6281234567890". */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function isIndonesianMobilePhone(value: string): boolean {
  return phoneRegex.test(normalizePhone(value));
}
