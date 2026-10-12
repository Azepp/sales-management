"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProofPayment {
  proofImageUrl?: string | null;
}

export function ProofLink({
  payments,
  label = "Lihat",
}: {
  payments: ProofPayment[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const proofUrls = payments.flatMap((payment) =>
    payment.proofImageUrl ? [payment.proofImageUrl] : []
  );
  if (proofUrls.length === 0) return <span className="text-sm text-gray-400">-</span>;

  const selectedUrl = proofUrls[selectedIndex];
  const isPdf = /\.pdf(?:[?#]|$)/i.test(selectedUrl);

  return (
    <div className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setSelectedIndex(0);
          setPreviewLoading(true);
          setPreviewError(false);
          setOpen(true);
        }}
        disabled={open}
        className="text-sm text-blue-600 hover:underline"
      >
        {label}{proofUrls.length > 1 ? ` (${proofUrls.length})` : ""}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90dvh] w-[min(96vw,72rem)] max-w-none flex-col overflow-hidden p-4 md:h-[90dvh] md:w-[min(96vw,72rem)] md:max-w-none lg:h-[90dvh] lg:w-[min(96vw,72rem)] lg:min-h-0 lg:min-w-0">
          <DialogHeader>
            <DialogTitle>Bukti pembayaran</DialogTitle>
            <DialogDescription>
              {isPdf ? "Dokumen PDF" : "Pratinjau gambar bukti pembayaran"}
            </DialogDescription>
          </DialogHeader>
          {proofUrls.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {proofUrls.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(index);
                    setPreviewLoading(true);
                    setPreviewError(false);
                  }}
                  aria-pressed={selectedIndex === index}
                  className={`rounded border px-3 py-1 text-sm ${
                    selectedIndex === index
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  Bukti {index + 1}
                </button>
              ))}
            </div>
          )}
          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-md bg-black/5">
            {previewLoading && (
              <div className="absolute z-10 flex items-center gap-2 rounded-md bg-white/90 px-4 py-3 text-sm text-gray-600 shadow">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Memuat bukti...
              </div>
            )}
            {previewError ? (
              <div className="space-y-2 p-4 text-center">
                <p className="text-sm text-red-600">Bukti tidak dapat dimuat.</p>
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  Buka bukti di tab baru
                </a>
              </div>
            ) : isPdf ? (
              <iframe
                src={selectedUrl}
                title="Dokumen bukti pembayaran"
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              // Supabase image hosts vary by deployment, so render the original directly.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedUrl}
                alt={`Bukti pembayaran ${selectedIndex + 1}`}
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
