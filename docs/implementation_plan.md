# Pundi — Implementation Plan

Dashboard affiliate multi-platform untuk satu pengguna: memantau komisi, mengelola link, riset produk, dan (belakangan) menjalankan iklan dengan batas budget.

## 1. Scope & Prinsip

- **Single-user.** Tanpa multi-tenant dan billing. Auth cukup satu API key / satu akun.
- **Adapter per platform.** Satu interface, tiap platform (Shopee, TikTok Shop, dst.) cukup satu class.
- **API resmi dulu.** Tanpa scraping UI atau auto-post massal, supaya akun tidak kena ban.
- **Terbukti dulu, baru otomatis.** Ads automation dibangun terakhir, setelah ada niche/produk yang terbukti profit secara organik.
- **Uang disimpan sebagai integer (rupiah).** Hindari float.

## 2. Stack

| Bagian | Pilihan |
|---|---|
| Runtime | Node.js 24, TypeScript |
| Framework | NestJS |
| ORM | Prisma **7** (pin versi, jangan `latest`) + `@prisma/adapter-better-sqlite3` |
| Database | SQLite (awal) → PostgreSQL bila sudah di server |
| Config | `@nestjs/config` |
| Validasi | `class-validator`, `class-transformer` |
| Job/scheduler | `@nestjs/schedule` (awal) → pg-boss bila pindah ke PostgreSQL |
| Frontend | Ditentukan di Fase 3 (Flutter Web atau React) |

> Catatan: dokumentasi NestJS menyebut tag `latest` Prisma bisa mengarah ke pre-release v8. Instal dengan `prisma@7` dan `@prisma/client@7`. Ikuti panduan resmi: https://docs.nestjs.com/recipes/prisma

## 3. Struktur Folder (backend)

```
backend/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ prisma/                 # PrismaModule + PrismaService
│  ├─ common/                 # guard (API key), filter, util
│  ├─ platforms/
│  │  ├─ affiliate-platform.interface.ts
│  │  ├─ platforms.module.ts
│  │  ├─ shopee/              # ShopeeAdapter
│  │  └─ tiktok/              # TikTokAdapter
│  ├─ products/
│  ├─ links/                  # link manager + subId
│  ├─ contents/
│  ├─ commissions/
│  ├─ sync/                   # job tarik data berkala
│  ├─ dashboard/              # endpoint agregasi
│  └─ (nanti) research/ ads/ scheduler/
└─ .env
```

## 4. Draft Skema Data (Fase 1)

```prisma
model Platform {
  id        Int      @id @default(autoincrement())
  code      String   @unique          // "shopee" | "tiktok"
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Product {
  id             Int      @id @default(autoincrement())
  platformId     Int
  externalId     String
  name           String
  price          Int?                 // rupiah
  commissionRate Float?               // persen
  url            String?
  imageUrl       String?
  category       String?
  rating         Float?
  soldCount      Int?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([platformId, externalId])
}

model Content {
  id          Int       @id @default(autoincrement())
  title       String
  channel     String                  // "tiktok" | "instagram" | ...
  status      String    @default("draft") // draft | published
  externalUrl String?
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
}

model AffiliateLink {
  id          Int      @id @default(autoincrement())
  productId   Int
  contentId   Int?
  subId       String   @unique        // pengikat komisi -> konten
  trackingUrl String
  createdAt   DateTime @default(now())
}

model Commission {
  id                Int       @id @default(autoincrement())
  platformId        Int
  linkId            Int?
  orderExternalId   String
  productExternalId String?
  status            String            // pending | valid | cancelled
  amount            Int               // komisi, rupiah
  orderAmount       Int?
  orderedAt         DateTime
  settledAt         DateTime?
  raw               String?           // payload mentah (JSON string)
  @@unique([platformId, orderExternalId, productExternalId])
}

model SyncRun {
  id              Int       @id @default(autoincrement())
  platformId      Int
  startedAt       DateTime  @default(now())
  finishedAt      DateTime?
  status          String            // running | ok | failed
  recordsUpserted Int       @default(0)
  error           String?
}
```

Tabel tambahan di fase lanjut: `AdCampaign`, `BudgetRule`, `SpendLog`, `ProductScore`.

## 5. Fase Pengerjaan

### Fase 0 — Fondasi
**Tujuan:** project siap dikembangkan.
- [x] `nest new backend`, "Hello World!" tampil
- [x] Instal Prisma 7 + adapter SQLite, `prisma init --datasource-provider sqlite`
- [x] `ConfigModule` global, `.env` (`DATABASE_URL`, `API_KEY`)
- [x] `PrismaModule` + `PrismaService`
- [x] Guard API key sederhana + `ValidationPipe` global
- [x] Git init, `.env` masuk `.gitignore`

**Selesai bila:** `GET /health` mengembalikan OK dan bisa query SQLite lewat Prisma.

### Fase 1 — Data inti & Link Manager
**Tujuan:** bisa mencatat produk, konten, dan membuat link ber-`subId`.
- [x] Migrasi skema Fase 1
- [x] CRUD `Platform`, `Product`, `Content`
- [x] `LinksService`: generate `subId` unik per (produk, konten), simpan `trackingUrl`
- [x] Endpoint: `POST /links`, `GET /links`, `GET /contents/:id/links`

**Selesai bila:** untuk satu konten bisa dibuat link dan `subId`-nya tersimpan serta unik.

### Fase 2 — Adapter platform & sinkronisasi komisi
**Tujuan:** komisi dari platform masuk otomatis ke database.
- [x] **Riset dulu:** per platform, cek apakah ada API resmi atau hanya ekspor CSV, dan field apa yang tersedia (status, subId, nominal)
- [x] Definisikan interface `AffiliatePlatform` (`fetchCommissions(since)`, `buildLink(product, subId)`, opsional `fetchProducts()`)
- [x] Implement adapter pertama (platform yang akunnya sudah ada); fallback: impor CSV
- [x] `SyncService` dengan jadwal (mis. tiap 1–6 jam), upsert idempoten berdasar unique key, catat `SyncRun`
- [x] Petakan komisi ke `AffiliateLink` lewat `subId`
- [x] Endpoint: `POST /sync/:platform` (manual), `GET /sync/runs`

**Selesai bila:** menjalankan sync dua kali tidak membuat data ganda, dan komisi terhubung ke konten via `subId`.

### Fase 3 — Dashboard
**Tujuan:** satu tampilan untuk memantau semuanya.
- [x] Endpoint agregasi: total komisi pending vs valid, per platform, per produk, per konten, per periode
- [x] Putuskan frontend (Bootstrap 5.3 responsive dark/light SPA di `/app`)
- [x] Halaman: Ringkasan, Komisi, Produk, Konten & Link, Riwayat Sync
- [x] Import/ekspor CSV

**Selesai bila:** bisa menjawab "konten mana yang paling menghasilkan minggu ini?" hanya dari dashboard.

### Fase 4 — Product Research
**Tujuan:** daftar produk layak promosi setiap hari.
- [x] Ambil data produk dari feed/API platform
- [x] Skor produk: komisi %, harga, rating, tren penjualan
- [x] Endpoint + halaman "Rekomendasi hari ini", dengan filter niche dan harga
- [x] Tandai produk (shortlist / sudah dipakai / skip)

### Fase 5 — Content Assistant (LLM)
**Tujuan:** mempercepat produksi konten, tanpa menggantikan review manual.
- [ ] Layanan LLM: hook, script pendek, caption, hashtag per produk
- [ ] Simpan draft ke `Content` (status `draft`)
- [ ] Guardrail: tanpa klaim berlebihan, tanpa klaim kesehatan/medis
- [ ] Review manual wajib sebelum status `published`

### Fase 6 — Scheduler / Antrean Posting
**Tujuan:** merapikan jadwal posting.
- [ ] Antrean konten terjadwal + pengingat (notifikasi) untuk upload manual
- [ ] Auto-post hanya untuk platform yang menyediakan API resmi
- [ ] Batasi frekuensi untuk menghindari pola spam

### Fase 7 — Ads Manager + Budget Guard (opsional, terakhir)
**Tujuan:** iklan terkontrol, hanya bila organik sudah terbukti profit.
- [ ] Integrasi Marketing API (Meta/TikTok Ads) untuk buat dan pause campaign
- [ ] Tabel `BudgetRule`: batas harian dan bulanan
- [ ] **Budget guard:** job tiap N menit menarik spend; bila total mencapai batas → pause semua campaign dan kirim notifikasi
- [ ] Rule engine berbasis komisi **valid + pending** (bukan real-time), dengan jeda sebelum kill-rule agar tidak salah mematikan iklan yang sebenarnya profit
- [ ] Setiap iklan memakai `subId` unik

### Fase 8 — Analytics
- [ ] ROI per konten, niche, platform
- [ ] ROI per jam kerja
- [ ] Laporan mingguan

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| API affiliate tidak terbuka untuk semua platform | Riset di awal Fase 2, siapkan jalur impor CSV |
| Komisi baru valid setelah beberapa hari | Tampilkan pending dan valid terpisah, jangan ambil keputusan dari angka real-time |
| Akun ads/affiliate diblokir | Patuhi T&C, pakai landing page sendiri, hindari klaim berlebihan |
| Konten otomatis ditekan algoritma | Konten tetap direview manual, volume wajar |
| Kebocoran kredensial platform | Simpan di `.env`, jangan commit, rotasi bila perlu |
| Prisma versi berubah | Pin `prisma@7` dan `@prisma/client@7` |

## 7. Keputusan Terbuka

1. Platform pertama untuk Fase 2: Shopee Affiliate atau TikTok Shop?
2. Frontend: Flutter Web atau React/Next?
3. Kapan pindah dari SQLite ke PostgreSQL (saat deploy ke server)?
4. Tempat hosting (VPS kecil / lokal dulu)?

## 8. Urutan Kerja yang Disarankan

`Fase 0 → 1 → 2 → 3` adalah MVP (sekitar 2–3 minggu). Fase 4–8 dikerjakan bertahap setelah MVP terbukti berguna.