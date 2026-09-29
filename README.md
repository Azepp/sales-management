# Binwich Management

Aplikasi manajemen penjualan dan inventaris untuk bisnis kuliner (binwich/sandwich). Dibangun dengan **Next.js 15**, **React 19**, **Prisma ORM**, **Supabase**, dan **Tailwind CSS**.

## Fitur Utama

- **Dashboard** - Ringkasan penjualan, stok, dan keuangan real-time
- **Penjualan** - Kelola transaksi, invoice, status pesanan, pembayaran
- **Produk** - CRUD produk, stok, harga beli/jual, kategori
- **Keuangan** - Modal, pengeluaran, laporan laba rugi
- **Laporan** - Ekspor Excel, filter tanggal, analisis penjualan
- **Autentikasi** - Login email/password via Supabase Auth

---

## Persyaratan Sebelum Install

| Tools | Versi Minimum | Keterangan |
|-------|--------------|------------|
| Node.js | 20+ | [Download](https://nodejs.org/) |
| npm / pnpm | 9+ | Sudah termasuk di Node.js |
| Git | Latest | [Download](https://git-scm.com/) |
| Akun Supabase | Gratis | [Daftar](https://supabase.com/) |
| Akun Vercel | Gratis | [Daftar](https://vercel.com/) |

---

## Langkah-Langkah Instalasi (Pemula Friendly)

### 1. Clone Repository

```bash
git clone https://github.com/Azepp/binwich-management.git
cd binwich-management
```

### 2. Install Dependencies

```bash
npm install
# atau
pnpm install
```

### 3. Setup Supabase (Database + Auth)

#### A. Buat Project Baru di Supabase
1. Buka [supabase.com](https://supabase.com/) → **New Project**
2. Isi nama project, password database, pilih region terdekat
3. Tunggu 2-3 menit sampai selesai

#### B. Ambil Kredensial Database
1. Di dashboard Supabase → **Settings** (ikon gear) → **Database**
2. Scroll ke **Connection pooling** → pilih **Transaction mode (port 6543)**
3. Copy **Connection string** → ganti `[YOUR-PASSWORD]` dengan password database Anda
4. Format: `postgresql://postgres.xxx:password@aws-xx.pooler.supabase.com:6543/postgres?pgbouncer=true`

#### C. Ambil Kredensial Auth
1. **Settings** → **API**
2. Copy **Project URL** dan **anon public key**

#### D. Buat Storage Bucket (Untuk Bukti Pembayaran)
1. **Storage** → **New bucket**
2. Nama: `payment-proofs`
3. **Public bucket** → **Ya**
4. **Save**

### 4. Konfigurasi Environment Variables

Buat file `.env` di root project (copy dari `.env.example` jika ada):

```env
# Supabase Auth & Client
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIs..."

# Database (Transaction mode - untuk aplikasi)
DATABASE_URL="postgresql://postgres.xxx:password@aws-xx.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Database (Session mode - untuk migrasi Prisma)
DIRECT_URL="postgresql://postgres.xxx:password@aws-xx.pooler.supabase.com:5432/postgres"

# Storage
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET="payment-proofs"
```

> **Penting:** `DIRECT_URL` pakai port `5432` (session mode), `DATABASE_URL` pakai port `6543` (transaction mode).

### 5. Setup Database (Migrasi Prisma)

```bash
# Generate Prisma Client
npx prisma generate

# Push schema ke database (development)
npx prisma db push

# Atau jalankan migrasi (production)
npx prisma migrate deploy
```

### 6. Jalankan Development Server

```bash
npm run dev
```

Buka browser: **http://localhost:3000**

### 7. Buat Akun Admin Pertama
1. Buka halaman login
2. Klik **Sign Up** / daftar akun baru
3. Verifikasi email (cek inbox/spam)
4. Login dengan akun yang baru dibuat

---

## Deploy ke Vercel (Production)

### 1. Push ke GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import di Vercel
1. Buka [vercel.com](https://vercel.com/) → **Add New Project**
2. Import repository GitHub Anda
3. Framework preset: **Next.js** (otomatis terdeteksi)

### 3. Set Environment Variables di Vercel
Di **Settings** → **Environment Variables**, tambahkan **semua** variable dari `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`

> **Tip:** Set environment untuk **Production**, **Preview**, dan **Development** semua sama.

### 4. Deploy
Klik **Deploy**. Tunggu 2-3 menit. Selesai! 🎉

### 5. (Opsional) Custom Domain
Di **Settings** → **Domains** → **Add** domain Anda.

---

## Tech Stack Singkat

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Framework** | Next.js 15 (App Router) | Full-stack React, SSR, SEO-ready |
| **Language** | TypeScript | Type safety, DX bagus |
| **Database** | PostgreSQL (Supabase) | Managed, scalable, realtime |
| **ORM** | Prisma 7 | Type-safe DB access, migrasi mudah |
| **Auth** | Supabase Auth | Email/password, session management |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first, accessible components |
| **Charts** | Recharts | Visualisasi data ringan |
| **Export** | ExcelJS | Laporan Excel profesional |

---

## Keamanan (Ringkas)

- **Row Level Security (RLS)** di Supabase - data terisolasi per user
- **Server-side validation** di API routes - tidak percaya client
- **Environment variables** - secret tidak masuk ke bundle client
- **Prepared statements** via Prisma - anti SQL injection
- **HTTPS only** di Vercel & Supabase - enkripsi transit
- **HttpOnly cookies** untuk session - anti XSS

---

## Struktur Project (Ringkas)

```
binwich-management/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Route group halaman utama
│   │   ├── penjualan/      # Manajemen transaksi
│   │   ├── produk/         # CRUD produk
│   │   ├── keuangan/       # Modal & pengeluaran
│   │   └── laporan/        # Ekspor & analisis
│   ├── api/                # API routes (server-side)
│   └── login/              # Halaman autentikasi
├── components/             # React components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── prisma.ts           # Prisma Client singleton
│   ├── supabase/           # Supabase client (server & browser)
│   └── utils.ts            # Helper functions
├── prisma/
│   ├── schema.prisma       # Schema database
│   └── config.ts           # Config migrasi Prisma 7
└── .env                    # Environment variables (local only)
```

---

## Scripts Berguna

```bash
npm run dev         # Development server (Turbopack)
npm run build       # Production build
npm run start       # Jalankan production build
npm run lint        # ESLint check

# Prisma
npx prisma generate     # Generate client
npx prisma db push      # Push schema (dev)
npx prisma migrate dev  # Buat & jalankan migrasi
npx prisma studio       # GUI database
```

---

## Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| `PrismaClientKnownRequestError` | Cek `DATABASE_URL` & `DIRECT_URL` di `.env` |
| `Supabase Auth error` | Pastikan `NEXT_PUBLIC_SUPABASE_URL` & `ANON_KEY` benar |
| `Build failed Vercel` | Set semua env vars di Vercel Settings |
| `Port 3000 sudah dipakai` | `npm run dev -- -p 3001` |
| `Module not found` | Hapus `node_modules` & `package-lock.json` → `npm install` |

---

## Kontribusi

1. Fork repository
2. Buat branch: `git checkout -b fitur-baru`
3. Commit: `git commit -m "Tambah fitur X"`
4. Push: `git push origin fitur-baru`
5. Buat Pull Request

---

## Lisensi

MIT License - bebas digunakan untuk keperluan pribadi maupun komersial.

---

## Bantuan

- **Docs Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Docs Prisma**: [prisma.io/docs](https://www.prisma.io/docs)
- **Docs Supabase**: [supabase.com/docs](https://supabase.com/docs)

---

*Dibuat oleh Cecep untuk kemudahan manajemen penjualan level pemula*