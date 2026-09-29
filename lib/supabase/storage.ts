import { createClient } from "./server";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "payment-proofs";

export async function uploadPaymentProof(file: File): Promise<string | null> {
  try {
    const supabase = await createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `payment-proof-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error("uploadPaymentProof:", error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    console.error("uploadPaymentProof:", error);
    return null;
  }
}
