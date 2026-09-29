interface ProofPayment {
  proofImageUrl?: string | null;
}

export function ProofLink({ payments }: { payments: ProofPayment[] }) {
  const proofUrl = payments.find((p) => p.proofImageUrl)?.proofImageUrl;
  if (!proofUrl) return <span className="text-sm text-gray-400">-</span>;

  const count = payments.filter((p) => p.proofImageUrl).length;

  return (
    <a
      href={proofUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-sm text-blue-600 hover:underline"
    >
      Lihat{count > 1 ? ` (${count})` : ""}
    </a>
  );
}
