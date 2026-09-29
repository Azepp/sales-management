# PRD — Binwich Management

**Versi:** 1.0
**Tanggal:** 26 September 2026
**Tipe Aplikasi:** Web app internal, single-user, diakses online
**Bahasa UI:** Bahasa Indonesia

---

## 1. Ringkasan Projek

Binwich Management adalah aplikasi web untuk mengelola operasional penjualan sebuah usaha, mencakup pencatatan modal & pengeluaran, manajemen stok produk, transaksi penjualan (termasuk pre-order), pembayaran & bukti transaksi, retur, hingga laporan keuangan. Aplikasi ini dipakai oleh **satu pengguna (owner)**, sehingga tidak memerlukan sistem role/permission yang kompleks — namun tetap harus aman karena menyimpan data keuangan dan bukti pembayaran.

### 1.1 Tujuan
- Owner bisa mencatat modal, pengeluaran, dan penjualan dalam satu tempat.
- Owner bisa memantau stok produk secara akurat (in/out).
- Owner bisa membuat transaksi penjualan termasuk pre-order, diskon (persen/nominal), dan multi-item.
- Owner bisa melacak status pembayaran dan status pengiriman/pengambilan barang secara terpisah.
- Owner bisa melihat laporan laba-rugi dan laporan penjualan, serta export ke Excel/CSV.
- Owner bisa mengakses aplikasi ini dari mana saja secara online, termasuk dari mobile.

### 1.2 Non-Goals (di luar scope v1)
- Multi-user / role & permission.
- Payment gateway otomatis (pembayaran tetap manual + upload bukti).
- Sistem loyalty/poin customer.
- Integrasi akuntansi pihak ketiga.

---

## 2. Tech Stack

| Layer | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js (App Router) | Frontend + backend (API routes) dalam satu project |
| Bahasa | TypeScript | Type-safety end-to-end |
| Styling | Tailwind CSS | Utility-first, mudah maintain |
| UI Component | shadcn/ui | Komponen siap pakai, mudah dikustom, konsisten |
| Database | Supabase (PostgreSQL) | Free tier cukup untuk skala 1 user |
| ORM | Prisma | Schema-first, type-safe query |
| Auth | Supabase Auth (single akun) | Email + password, tanpa role multi-level |
| Storage | Supabase Storage | Untuk upload bukti pembayaran |
| Chart | Recharts | Untuk dashboard & laporan |
| Export Excel/CSV | `exceljs` atau `xlsx` (SheetJS) | Generate file di API route, return sebagai download |
| Hosting | Vercel (app) + Supabase (DB & Storage) | Free tier, minim maintenance |

---

## 3. Prinsip Desain UI/UX

- **Simple tapi tetap user-friendly** — hindari clutter, prioritaskan aksi yang paling sering dipakai (tambah transaksi, cek stok, lihat laporan).
- **Konsisten** — gunakan komponen shadcn/ui apa adanya sebisa mungkin, jangan reinvent komponen yang sudah tersedia (Button, Table, Dialog, Select, Badge, Card, Tabs, dsb).
- **Bahasa Indonesia di seluruh UI** — label, tombol, pesan error, notifikasi, semua dalam Bahasa Indonesia yang natural (bukan terjemahan kaku).
- **Responsive wajib** — layout harus nyaman di mobile (khususnya karena owner kemungkinan input data dari HP saat di lokasi usaha). Gunakan:
  - Table → berubah jadi card list di layar kecil (breakpoint `md`).
  - Sidebar navigasi → jadi bottom nav atau hamburger menu di mobile.
  - Form input → full width di mobile, grid 2 kolom di desktop.
- **Warna status konsisten** di seluruh aplikasi (badge):
  - 🟡 Kuning = Pending
  - 🔵 Biru = Ready
  - 🟢 Hijau = Delivered / Lunas
  - 🔴 Merah = Cancelled / Belum Lunas
  - ⚪ Abu-abu = Draft/lainnya

---

## 4. Struktur Database (Prisma Schema — Konsep)

```prisma
model Capital {
  id        String   @id @default(cuid())
  date      DateTime
  amount    Decimal
  note      String?
  createdAt DateTime @default(now())
}

model Expense {
  id        String   @id @default(cuid())
  date      DateTime
  category  String   // sewa, gaji, listrik, bahan_baku, lain_lain
  amount    Decimal
  note      String?
  createdAt DateTime @default(now())
}

model Product {
  id          String   @id @default(cuid())
  name        String
  sku         String?  @unique
  category    String?
  unit        String?  // pcs, kg, box, dll (opsional)
  costPrice   Decimal
  sellPrice   Decimal
  stockQty    Int      @default(0)
  minStock    Int      @default(5) // threshold notifikasi stok menipis
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  stockMovements StockMovement[]
  saleItems      SaleItem[]
  returns        Return[]
}

model StockMovement {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  type      String   // "in" | "out"
  qty       Int
  date      DateTime @default(now())
  note      String?
}

model Sale {
  id                String   @id @default(cuid())
  invoiceNumber     String   @unique
  date              DateTime @default(now())
  customerName      String
  orderType         String   // "regular" | "preorder"
  fulfillmentStatus String   // "pending" | "ready" | "delivered" | "cancelled"
  paymentStatus     String   // "unpaid" | "dp" | "paid_full"
  estReadyDate      DateTime?
  subtotal          Decimal
  discountType      String?  // "percent" | "fixed"
  discountValue     Decimal? // nilai input (misal 10 utk 10%, atau 5000 utk Rp5000)
  discountAmount    Decimal  @default(0) // hasil akhir potongan dalam Rupiah
  total             Decimal
  cancelReason      String?
  note              String?
  createdAt         DateTime @default(now())

  items    SaleItem[]
  payments Payment[]
  returns  Return[]
}

model SaleItem {
  id           String  @id @default(cuid())
  saleId       String
  sale         Sale    @relation(fields: [saleId], references: [id])
  productId    String
  product      Product @relation(fields: [productId], references: [id])
  qty          Int
  priceAtSale  Decimal // harga jual saat transaksi, bukan harga produk sekarang
  subtotal     Decimal
}

model Payment {
  id            String   @id @default(cuid())
  saleId        String
  sale          Sale     @relation(fields: [saleId], references: [id])
  date          DateTime @default(now())
  amount        Decimal
  method        String   // "cash" | "transfer" | "qris" | "lainnya"
  proofImageUrl String?
  note          String?
}

model Return {
  id           String   @id @default(cuid())
  saleId       String
  sale         Sale     @relation(fields: [saleId], references: [id])
  productId    String
  product      Product  @relation(fields: [productId], references: [id])
  qty          Int
  reason       String
  refundAmount Decimal
  date         DateTime @default(now())
}
```

**Catatan penting untuk implementasi:**
- `stockQty` di `Product` adalah nilai cache, harus selalu diupdate lewat `StockMovement`, tidak boleh ditulis manual di luar itu.
- Stok pre-order **tidak dikurangi** saat order dibuat (`fulfillmentStatus = pending`), baru dikurangi saat berubah jadi `ready`.
- Kalau transaksi di-cancel setelah stok terlanjur dikurangi, sistem harus otomatis mengembalikan stok (buat `StockMovement` type `in` sebagai kompensasi).
- `paidAmount` per sale **dihitung** dari `SUM(Payment.amount) WHERE saleId = ...`, bukan kolom statis, supaya selalu akurat.
- Retur mempengaruhi: (1) stok — barang balik ke gudang lewat `StockMovement` type `in`, (2) laporan laba-rugi — `refundAmount` mengurangi total penjualan pada periode terkait.
- Laporan laba-rugi hanya menghitung `Sale` dengan `fulfillmentStatus = delivered` dan bukan `cancelled`.

---

## 5. Breakdown Fitur & Halaman

### 5.1 Dashboard (`/`)
- Kartu ringkasan: Omzet hari ini, Modal+Pengeluaran bulan ini, Estimasi laba bersih bulan berjalan, Total piutang aktif.
- Daftar actionable:
  - Stok menipis (produk dengan `stockQty <= minStock`)
  - Order `ready` tapi belum `delivered`
  - Piutang (order dengan `paymentStatus != paid_full`)
- Grafik: tren penjualan 7/30 hari terakhir (line chart), produk terlaris bulan ini (bar chart).

### 5.2 Modal & Pengeluaran (`/keuangan`)
- Tab "Modal": list + form tambah (tanggal, jumlah, catatan).
- Tab "Pengeluaran": list + form tambah (tanggal, kategori, jumlah, catatan).
- **Filter:** rentang tanggal, kategori (khusus pengeluaran).

### 5.3 Produk & Stok (`/produk`)
- Tabel produk: nama, SKU, kategori, harga modal, harga jual, stok saat ini, status (aktif/nonaktif).
- Form tambah/edit produk.
- Tombol "Restock" → buka dialog input qty masuk + catatan → otomatis buat `StockMovement`.
- Tab/halaman terpisah "Riwayat Mutasi Stok" per produk.
- **Filter:** kategori, status stok (menipis/aman), status aktif/nonaktif, pencarian nama/SKU.

### 5.4 Penjualan (`/penjualan`)
- Tabel daftar transaksi: invoice, tanggal, customer, tipe order, total, status pembayaran, status fulfillment.
- Badge warna untuk kedua status (lihat bagian 3).
- Form transaksi baru:
  - Nama customer
  - Tipe order (regular/preorder)
  - Multi-item: pilih produk, qty, harga otomatis terisi dari harga produk (bisa override kalau perlu)
  - Diskon: toggle persen/nominal, kalkulasi otomatis realtime
  - Estimasi tanggal siap (khusus preorder)
- Detail transaksi: rincian item, riwayat pembayaran + bukti, tombol update status, tombol tambah pembayaran (dengan upload bukti), tombol retur, tombol cancel (dengan alasan).
- **Filter (lengkap, ini poin penting dari user):**
  - Rentang tanggal
  - Tipe order (regular/preorder/semua)
  - Status fulfillment (pending/ready/delivered/cancelled)
  - Status pembayaran (unpaid/dp/paid_full)
  - Nama customer (pencarian)
  - Kombinasi cepat: tombol shortcut "Ready & Belum Diambil", "Belum Lunas"

### 5.5 Laporan (`/laporan`)
- Tab "Laba Rugi": total penjualan, HPP, total pengeluaran, laba bersih — per rentang tanggal yang dipilih.
- Tab "Penjualan": daftar transaksi + produk terlaris, filter sama seperti halaman penjualan.
- Tab "Stok": posisi stok saat ini + riwayat mutasi.
- Tab "Piutang": daftar order yang belum lunas.
- Tombol **Export Excel/CSV** di setiap tab, mengikuti filter yang sedang aktif.

### 5.6 Invoice/Struk (`/penjualan/[id]/invoice`)
- Halaman cetak-friendly (bisa Ctrl+P → save as PDF), berisi nomor invoice, tanggal, customer, rincian item, diskon, total, status pembayaran.

---

## 6. Keamanan (Security Requirements)

- **Autentikasi:** wajib login (Supabase Auth), tidak ada halaman yang bisa diakses tanpa login kecuali halaman login itu sendiri.
- **Session:** gunakan session/cookie httpOnly, jangan simpan token di localStorage.
- **Authorization di API route:** setiap request ke API harus divalidasi session di server-side, jangan hanya mengandalkan proteksi di sisi client.
- **Environment variables:** semua kredensial (Supabase URL, service role key, dsb) disimpan di `.env`, tidak pernah di-commit ke repo, tidak pernah diekspos ke client-side kecuali key yang memang public (anon key).
- **Validasi input di server:** semua input (form) divalidasi ulang di API route (misal pakai Zod), jangan percaya validasi dari client saja.
- **Upload file (bukti pembayaran):** batasi tipe file (jpg/png/pdf) dan ukuran maksimal, simpan di bucket Supabase Storage yang private, akses lewat signed URL saja.
- **Rate limiting sederhana:** khususnya di endpoint login, untuk mencegah brute force.
- **Backup data:** aktifkan backup otomatis Supabase (kalau plan mendukung), atau jadwalkan export manual berkala karena ini data keuangan.
- **HTTPS:** otomatis lewat Vercel, pastikan tidak ada mixed content.

---

## 7. Kriteria Selesai (Definition of Done) per Modul

| Modul | Kriteria |
|---|---|
| Modal & Pengeluaran | Bisa tambah/lihat/filter data, total ter-summary di dashboard |
| Produk & Stok | Bisa CRUD produk, restock, dan riwayat mutasi tercatat otomatis |
| Penjualan | Bisa buat transaksi multi-item, diskon persen/nominal terhitung benar, stok berkurang sesuai aturan (regular vs preorder) |
| Status Fulfillment & Pembayaran | Dua status independen, bisa difilter kombinasi, badge warna sesuai standar |
| Bukti Transaksi | Bisa upload bukti bayar per pembayaran, bisa cetak invoice |
| Retur & Cancel | Retur mengembalikan stok & mengurangi laba-rugi; cancel mengembalikan stok tanpa hapus histori |
| Laporan | Laba-rugi akurat (hanya hitung `delivered`, dikurangi retur), bisa export Excel/CSV sesuai filter |
| Responsive | Semua halaman nyaman dipakai di layar mobile (uji di lebar ≤ 400px) |
| Keamanan | Tidak ada halaman/API yang bisa diakses tanpa autentikasi |

---

## 8. Setup & Environment (untuk dieksekusi coding agent)

### 8.1 Setup Supabase (dashboard supabase.com)

1. Buat akun/login di supabase.com → **New Project** → isi nama project, buat password database (simpan), pilih region **Singapore**, klik Create.
2. Buka **Project Settings > API** → copy `Project URL` dan `anon public key`.
3. Buka **Project Settings > Database > Connection string**:
   - Mode **Transaction** (port 6543, ada `?pgbouncer=true`) → dipakai untuk `DATABASE_URL`
   - Mode **Session** (port 5432) → dipakai untuk `DIRECT_URL` (khusus migrasi)
4. Buka **Authentication > Users > Add User** → buat 1 akun (aplikasi ini single-user, tidak perlu sign-up flow).
5. Buka **Storage > New Bucket** → buat bucket `payment-proofs`, set **Private** (akses lewat signed URL, bukan link publik).

### 8.2 Command setup project

```bash
# 1. Buat project Next.js
npx create-next-app@latest binwich-management
# Pilih: TypeScript = Yes, ESLint = Yes, Tailwind = Yes, App Router = Yes

cd binwich-management

# 2. Install dependency
npm install prisma @prisma/client @supabase/supabase-js @supabase/ssr recharts exceljs zod
npm install -D prisma

# 3. Setup shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button table dialog select badge card tabs input label form textarea

# 4. Inisialisasi Prisma
npx prisma init
```

### 8.3 File konfigurasi yang harus dibuat

| File | Isi/Fungsi |
|---|---|
| `prisma/schema.prisma` | Timpa dengan schema lengkap di Bagian 4 PRD ini |
| `.env` | `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` — isi dari kredensial 8.1 |
| `lib/prisma.ts` | Prisma client singleton (cegah multi-instance saat hot-reload) |
| `lib/supabase/client.ts` | Supabase client untuk Client Component (`createBrowserClient`) |
| `lib/supabase/server.ts` | Supabase client untuk Server Component/Route Handler (`createServerClient` + cookies) |
| `middleware.ts` | Cek session di semua route kecuali `/login`; redirect ke `/login` kalau belum auth, redirect ke `/` kalau sudah auth tapi buka `/login` |

### 8.4 Menjalankan migrasi Prisma

```bash
npx prisma migrate dev --name init
npx prisma studio   # verifikasi semua 8 tabel sudah terbentuk sesuai schema
```

Kalau schema berubah di kemudian hari, jalankan `npx prisma migrate dev --name <nama_perubahan>` lagi (jangan edit tabel manual lewat Supabase dashboard, supaya migrasi tetap tercatat sebagai source of truth).

### 8.5 Halaman login

Buat `app/login/page.tsx` (Client Component), form email + password memanggil:
```ts
const supabase = createClient(); // dari lib/supabase/client.ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
```
Redirect ke `/` setelah sukses — middleware yang menangani proteksi halaman lain.

### 8.6 Menjalankan project

```bash
npm run dev
```
Buka `http://localhost:3000` → otomatis redirect ke `/login` (via middleware) → login dengan akun dari langkah 8.1.5.

### 8.7 Deploy

1. Push ke GitHub.
2. Import repo di vercel.com → New Project.
3. Masukkan semua isi `.env` ke **Environment Variables** di Vercel (jangan commit `.env` ke Git, pastikan ada di `.gitignore`).
4. Deploy — database tetap di Supabase, tidak perlu setup database terpisah di Vercel.

---

## 9. Urutan Pengerjaan yang Disarankan

1. Setup Supabase + project Next.js + Auth (Bagian 8 di atas)
2. Schema database & migrasi (semua tabel di Bagian 4)
3. Modul Produk & Stok (paling dasar, dipakai modul lain)
4. Modul Penjualan (form transaksi, diskon, status, stok otomatis)
5. Modul Pembayaran & Bukti (upload ke Storage)
6. Modul Modal & Pengeluaran
7. Modul Retur & Cancel
8. Dashboard (agregasi dari semua modul di atas)
9. Laporan + Export Excel/CSV
10. Polish responsive + review keamanan menyeluruh
