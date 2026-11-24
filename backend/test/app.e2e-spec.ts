import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Pundi Backend (e2e)', () => {
  let app: INestApplication<App>;
  const apiKey = 'pundi-secret-api-key';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Foundation (Fase 0)', () => {
    it('/health (GET) should return 200 without API key', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({
          status: 'ok',
          database: 'connected',
        });
    });

    it('protected route should return 401 without API key', () => {
      return request(app.getHttpServer()).get('/platforms').expect(401);
    });
  });

  describe('Core Data & Link Manager (Fase 1)', () => {
    const uniqueSuffix = Date.now().toString();
    let platformId: number;
    let productId: number;
    let contentId: number;
    let linkId: number;
    let generatedSubId: string;

    it('should create a new platform', async () => {
      const res = await request(app.getHttpServer())
        .post('/platforms')
        .set('x-api-key', apiKey)
        .send({
          code: `shopee_${uniqueSuffix}`,
          name: 'Shopee Affiliate Program',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe(`shopee_${uniqueSuffix}`);
      platformId = res.body.id;
    });

    it('should create a product for the platform', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('x-api-key', apiKey)
        .send({
          platformId,
          externalId: `ext_${uniqueSuffix}`,
          name: 'Termos Stainless Steel 500ml',
          price: 85000,
          commissionRate: 12.5,
          url: 'https://shopee.co.id/product/12345',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Termos Stainless Steel 500ml');
      productId = res.body.id;
    });

    it('should create content', async () => {
      const res = await request(app.getHttpServer())
        .post('/contents')
        .set('x-api-key', apiKey)
        .send({
          title: 'Review Termos Tahan Dingin 24 Jam',
          channel: 'tiktok',
          status: 'published',
          externalUrl: 'https://tiktok.com/@creator/video/98765',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('published');
      contentId = res.body.id;
    });

    it('should create an affiliate link with auto-generated unique subId for the content', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('x-api-key', apiKey)
        .send({
          productId,
          contentId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.subId).toMatch(new RegExp(`^c${contentId}_p${productId}_`));
      expect(res.body.trackingUrl).toContain(`sub_id=${res.body.subId}`);
      linkId = res.body.id;
      generatedSubId = res.body.subId;
    });

    it('should retrieve links for the content via GET /contents/:id/links', async () => {
      const res = await request(app.getHttpServer())
        .get(`/contents/${contentId}/links`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find((l: { id: number }) => l.id === linkId);
      expect(found).toBeDefined();
      expect(found.subId).toBe(generatedSubId);
      expect(found.product.id).toBe(productId);
    });

    it('should throw 409 when creating a link with duplicate subId', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('x-api-key', apiKey)
        .send({
          productId,
          contentId,
          customSubId: generatedSubId,
        })
        .expect(409);
    });
  });

  describe('Platform Adapter & Commission Sync (Fase 2)', () => {
    const uniqueSuffix = Date.now().toString();
    let platformId: number;
    let productId: number;
    let contentId: number;
    let generatedSubId: string;
    const orderExternalId = `ORD_${uniqueSuffix}`;

    it('setup: create platform shopee, product, content, and affiliate link', async () => {
      // 1. Create or ensure standard shopee platform
      const existingPlatRes = await request(app.getHttpServer())
        .get('/platforms')
        .set('x-api-key', apiKey)
        .expect(200);

      let shopeePlat = existingPlatRes.body.find(
        (p: { code: string }) => p.code === 'shopee',
      );
      if (!shopeePlat) {
        const createPlat = await request(app.getHttpServer())
          .post('/platforms')
          .set('x-api-key', apiKey)
          .send({ code: 'shopee', name: 'Shopee Official' })
          .expect(201);
        shopeePlat = createPlat.body;
      }
      platformId = shopeePlat.id;

      // 2. Create product
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-api-key', apiKey)
        .send({
          platformId,
          externalId: `ITEM_${uniqueSuffix}`,
          name: 'Botol Minum Olahraga',
          price: 50000,
          commissionRate: 10,
        })
        .expect(201);
      productId = prodRes.body.id;

      // 3. Create content
      const contentRes = await request(app.getHttpServer())
        .post('/contents')
        .set('x-api-key', apiKey)
        .send({
          title: 'Review Botol Olahraga 2 Liter',
          channel: 'instagram',
          status: 'published',
        })
        .expect(201);
      contentId = contentRes.body.id;

      // 4. Create affiliate link
      const linkRes = await request(app.getHttpServer())
        .post('/links')
        .set('x-api-key', apiKey)
        .send({
          productId,
          contentId,
        })
        .expect(201);
      generatedSubId = linkRes.body.subId;
    });

    it('should import commission CSV, map subId to link/content, and log SyncRun', async () => {
      const csvData = `No. Pesanan,ID Produk,Sub_id 1,Estimasi Komisi,Total Pembayaran,Status Pesanan,Waktu Pesanan
${orderExternalId},ITEM_${uniqueSuffix},${generatedSubId},Rp 15.000,Rp 150.000,Selesai,2026-11-24 10:00:00`;

      const syncRes = await request(app.getHttpServer())
        .post('/sync/shopee/csv')
        .set('x-api-key', apiKey)
        .send({ csv: csvData })
        .expect(201);

      expect(syncRes.body.status).toBe('ok');
      expect(syncRes.body.recordsUpserted).toBe(1);

      // Verify commission record in GET /commissions
      const commRes = await request(app.getHttpServer())
        .get(`/commissions?subId=${generatedSubId}`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(commRes.body).toHaveLength(1);
      const comm = commRes.body[0];
      expect(comm.orderExternalId).toBe(orderExternalId);
      expect(comm.amount).toBe(15000);
      expect(comm.orderAmount).toBe(150000);
      expect(comm.status).toBe('valid');
      expect(comm.link).toBeDefined();
      expect(comm.link.subId).toBe(generatedSubId);
      expect(comm.link.content.id).toBe(contentId);
    });

    it('idempotency test: importing the exact same CSV twice does not create duplicate commissions', async () => {
      const csvData = `No. Pesanan,ID Produk,Sub_id 1,Estimasi Komisi,Total Pembayaran,Status Pesanan,Waktu Pesanan
${orderExternalId},ITEM_${uniqueSuffix},${generatedSubId},Rp 15.000,Rp 150.000,Selesai,2026-11-24 10:00:00`;

      // Import again
      const syncRes2 = await request(app.getHttpServer())
        .post('/sync/shopee/csv')
        .set('x-api-key', apiKey)
        .send({ csv: csvData })
        .expect(201);

      expect(syncRes2.body.status).toBe('ok');
      expect(syncRes2.body.recordsUpserted).toBe(1);

      // Verify commission count for this subId is still exactly 1
      const commRes = await request(app.getHttpServer())
        .get(`/commissions?subId=${generatedSubId}`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(commRes.body).toHaveLength(1);
      expect(commRes.body[0].orderExternalId).toBe(orderExternalId);
      expect(commRes.body[0].amount).toBe(15000);
    });

    it('should list sync history in GET /sync/runs', async () => {
      const runsRes = await request(app.getHttpServer())
        .get('/sync/runs')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(runsRes.body)).toBe(true);
      expect(runsRes.body.length).toBeGreaterThanOrEqual(1);
      expect(runsRes.body[0].status).toBe('ok');
      expect(runsRes.body[0].recordsUpserted).toBeGreaterThanOrEqual(1);
    });

    it('should return aggregated commissions summary in GET /commissions/summary', async () => {
      const summaryRes = await request(app.getHttpServer())
        .get('/commissions/summary')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(summaryRes.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(summaryRes.body.totalValid).toBeGreaterThanOrEqual(15000);
      expect(summaryRes.body.totalOrderAmount).toBeGreaterThanOrEqual(150000);
    });
  });

  describe('Dashboard Aggregations (Fase 3)', () => {
    it('GET /dashboard/summary should return total metrics and platform breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(res.body.totalValid).toBeGreaterThanOrEqual(15000);
      expect(Array.isArray(res.body.platforms)).toBe(true);
      expect(res.body.platforms.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /dashboard/top-contents should return top earning contents', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/top-contents?period=7d')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const top = res.body[0];
      expect(top.contentId).toBeDefined();
      expect(top.title).toBeDefined();
      expect(top.validCommission).toBeGreaterThanOrEqual(15000);
    });

    it('GET /dashboard/top-products should return top earning products', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/top-products')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productId).toBeDefined();
      expect(res.body[0].validCommission).toBeGreaterThanOrEqual(15000);
    });

    it('GET /dashboard/recent-activity should return recent syncs and commissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/recent-activity')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body.recentSyncs)).toBe(true);
      expect(Array.isArray(res.body.recentCommissions)).toBe(true);
    });

    it('GET /app should serve the Bootstrap dashboard HTML without requiring API key', async () => {
      const res = await request(app.getHttpServer())
        .get('/app')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Pundi — Affiliate Dashboard');
      expect(res.text).toContain('bootstrap');
    });
  });

  describe('Product Research (Fase 4)', () => {
    let testProductId: number;

    beforeAll(async () => {
      // Create a test product with good stats for scoring
      const platRes = await request(app.getHttpServer())
        .get('/platforms')
        .set('x-api-key', apiKey);
      const platId = platRes.body[0].id;

      const pRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-api-key', apiKey)
        .send({
          platformId: platId,
          externalId: `research_${Date.now()}`,
          name: 'Panci Listrik Serbaguna 1.5L',
          price: 95000,
          commissionRate: 15,
          rating: 4.8,
          soldCount: 3500,
          category: 'Peralatan Dapur',
        })
        .expect(201);
      testProductId = pRes.body.id;
    });

    it('POST /research/calculate-scores should compute composite scores', async () => {
      const res = await request(app.getHttpServer())
        .post('/research/calculate-scores')
        .set('x-api-key', apiKey)
        .expect(201);

      expect(res.body.scoredCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /research/recommendations should return ranked products with score breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/research/recommendations?minScore=50')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const top = res.body[0];
      expect(top.score).toBeGreaterThanOrEqual(50);
      expect(top.breakdown).toBeDefined();
      expect(top.breakdown.commissionScore).toBeDefined();
      expect(top.product).toBeDefined();
    });

    it('PATCH /research/products/:id/status should update product research status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/research/products/${testProductId}/status`)
        .set('x-api-key', apiKey)
        .send({
          status: 'shortlisted',
          notes: 'Cocok untuk video konten masak akhir pekan',
        })
        .expect(200);

      expect(res.body.status).toBe('shortlisted');
      expect(res.body.notes).toBe('Cocok untuk video konten masak akhir pekan');

      // Verify filtered by shortlisted status
      const listRes = await request(app.getHttpServer())
        .get('/research/recommendations?status=shortlisted')
        .set('x-api-key', apiKey)
        .expect(200);

      const found = listRes.body.find((item: { productId: number }) => item.productId === testProductId);
      expect(found).toBeDefined();
      expect(found.status).toBe('shortlisted');
    });

    it('GET /research/categories should return available niches', async () => {
      const res = await request(app.getHttpServer())
        .get('/research/categories')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('Peralatan Dapur');
    });
  });

  describe('Content Assistant (Fase 5)', () => {
    let f5PlatformId: number;
    let f5ProductId: number;

    beforeEach(async () => {
      const suffix = Math.random().toString(36).substring(2, 9) + Date.now();
      // Create platform
      const platRes = await request(app.getHttpServer())
        .post('/platforms')
        .set('x-api-key', apiKey)
        .send({ name: `Platform F5 ${suffix}`, code: `f5_${suffix}`, baseUrl: 'https://f5.example.com' })
        .expect(201);
      f5PlatformId = platRes.body.id;

      // Create product
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-api-key', apiKey)
        .send({
          externalId: `ext_${suffix}`,
          name: `Produk F5 ${suffix}`,
          platformId: f5PlatformId,
          category: 'Kesehatan',
          price: 85000,
          commissionRate: 10,
          soldCount: 500,
          rating: 4.7,
        })
        .expect(201);
      f5ProductId = prodRes.body.id;
    });

    it('POST /assistant/generate should return content preview with guardrails passed', async () => {
      const res = await request(app.getHttpServer())
        .post('/assistant/generate')
        .set('x-api-key', apiKey)
        .send({
          productId: f5ProductId,
          channel: 'tiktok',
          angle: 'problem_solution',
          targetAudience: 'anak muda',
        })
        .expect(201);

      expect(res.body.hooks).toBeDefined();
      expect(Array.isArray(res.body.hooks)).toBe(true);
      expect(res.body.hooks.length).toBeGreaterThan(0);
      expect(res.body.shortScript).toBeDefined();
      expect(res.body.caption).toBeDefined();
      expect(Array.isArray(res.body.hashtags)).toBe(true);
      expect(res.body.guardrailsCheck).toBeDefined();
      expect(res.body.guardrailsCheck.passed).toBe(true);
      expect(res.body.product.id).toBe(f5ProductId);
      expect(res.body.channel).toBe('tiktok');
      expect(res.body.angle).toBe('problem_solution');
    });

    it('POST /assistant/generate should work with different angles', async () => {
      const angles = ['unboxing', 'comparison', 'storytelling', 'recommendation'];
      for (const angle of angles) {
        const res = await request(app.getHttpServer())
          .post('/assistant/generate')
          .set('x-api-key', apiKey)
          .send({ productId: f5ProductId, channel: 'instagram', angle })
          .expect(201);

        expect(res.body.hooks.length).toBeGreaterThan(0);
        expect(res.body.guardrailsCheck.passed).toBe(true);
      }
    });

    it('POST /assistant/generate-and-save should create a draft content with link', async () => {
      const res = await request(app.getHttpServer())
        .post('/assistant/generate-and-save')
        .set('x-api-key', apiKey)
        .send({
          productId: f5ProductId,
          channel: 'tiktok',
          angle: 'unboxing',
        })
        .expect(201);

      expect(res.body.content).toBeDefined();
      expect(res.body.content.status).toBe('draft'); // MANDATORY: must always be draft
      expect(res.body.link).toBeDefined();
      expect(res.body.link.subId).toBeDefined();
      expect(res.body.link.productId).toBe(f5ProductId);

      expect(res.body.content.id).toBeDefined();
    });

    it('PATCH /assistant/contents/:id/publish should publish a draft', async () => {
      // First create a draft
      const saveRes = await request(app.getHttpServer())
        .post('/assistant/generate-and-save')
        .set('x-api-key', apiKey)
        .send({ productId: f5ProductId, channel: 'instagram', angle: 'storytelling' })
        .expect(201);

      const contentId = saveRes.body.content.id;
      expect(saveRes.body.content.status).toBe('draft');

      // Now publish it
      const pubRes = await request(app.getHttpServer())
        .patch(`/assistant/contents/${contentId}/publish`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(pubRes.body.status).toBe('published');
      expect(pubRes.body.publishedAt).toBeDefined();
    });

    it('POST /assistant/generate should return 404 for non-existent product', () => {
      return request(app.getHttpServer())
        .post('/assistant/generate')
        .set('x-api-key', apiKey)
        .send({ productId: 999999, channel: 'tiktok' })
        .expect(404);
    });

    it('POST /assistant/generate should return 400 for missing productId', () => {
      return request(app.getHttpServer())
        .post('/assistant/generate')
        .set('x-api-key', apiKey)
        .send({ channel: 'tiktok' })
        .expect(400);
    });
  });

  describe('Scheduler & Antrean Posting (Fase 6)', () => {
    let f6ContentId: number;

    beforeEach(async () => {
      const suffix = Math.random().toString(36).substring(2, 9) + Date.now();
      const contentRes = await request(app.getHttpServer())
        .post('/contents')
        .set('x-api-key', apiKey)
        .send({
          title: `Konten Jadwal ${suffix}`,
          channel: 'instagram',
          status: 'draft',
        })
        .expect(201);
      f6ContentId = contentRes.body.id;
    });

    it('POST /scheduler/schedules should schedule content and transition status to scheduled', async () => {
      const scheduleTime = new Date(Date.now() + 86400000 * (2000 + Math.floor(Math.random() * 500))).toISOString();
      const res = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          channel: 'instagram',
          scheduledFor: scheduleTime,
          notes: 'Upload jam makan siang',
        })
        .expect(201);

      expect(res.body.schedule).toBeDefined();
      expect(res.body.schedule.status).toBe('pending');
      expect(res.body.schedule.contentId).toBe(f6ContentId);
      expect(res.body.frequencyCheck).toBeDefined();
      expect(res.body.frequencyCheck.allowed).toBe(true);

      // Verify content status changed to scheduled
      const contentCheck = await request(app.getHttpServer())
        .get(`/contents/${f6ContentId}`)
        .set('x-api-key', apiKey)
        .expect(200);
      expect(contentCheck.body.status).toBe('scheduled');
    });

    it('GET /scheduler/schedules should list scheduled items', async () => {
      const scheduleTime = new Date(Date.now() + 3600000).toISOString();
      await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          scheduledFor: scheduleTime,
          force: true,
        })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get('/scheduler/schedules?channel=instagram')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      const found = listRes.body.find((s: { contentId: number }) => s.contentId === f6ContentId);
      expect(found).toBeDefined();
      expect(found.status).toBe('pending');
    });

    it('GET /scheduler/frequency should return anti-spam daily posting quotas', async () => {
      const res = await request(app.getHttpServer())
        .get('/scheduler/frequency')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(res.body.date).toBeDefined();
      expect(Array.isArray(res.body.channels)).toBe(true);
      const ig = res.body.channels.find((c: { channel: string }) => c.channel === 'instagram');
      expect(ig).toBeDefined();
      expect(ig.maxLimit).toBe(3);
    });

    it('Anti-spam guard should block excess schedules on same date without force', async () => {
      const futureDays = 100 + Math.floor(Math.random() * 500);
      const targetDate = new Date(Date.now() + 86400000 * futureDays);
      targetDate.setHours(10, 0, 0, 0);

      // Instagram max limit is 3. Fill up 3 schedules
      for (let i = 0; i < 3; i++) {
        const dummyContent = await request(app.getHttpServer())
          .post('/contents')
          .set('x-api-key', apiKey)
          .send({ title: `Fill ${i} ${futureDays}`, channel: 'instagram', status: 'draft' })
          .expect(201);

        await request(app.getHttpServer())
          .post('/scheduler/schedules')
          .set('x-api-key', apiKey)
          .send({
            contentId: dummyContent.body.id,
            channel: 'instagram',
            scheduledFor: targetDate.toISOString(),
          })
          .expect(201);
      }

      // 4th schedule should be blocked by anti-spam guard
      const blockRes = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          channel: 'instagram',
          scheduledFor: targetDate.toISOString(),
        })
        .expect(400);

      expect(blockRes.body.error).toBe('SpamPatternPrevention');

      // But should succeed if force = true
      const forceRes = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          channel: 'instagram',
          scheduledFor: targetDate.toISOString(),
          force: true,
        })
        .expect(201);

      expect(forceRes.body.schedule).toBeDefined();
    });

    it('PATCH /scheduler/schedules/:id/posted should mark schedule as posted and content as published', async () => {
      const scheduleTime = new Date(Date.now() + 1800000).toISOString();
      const schedRes = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          scheduledFor: scheduleTime,
          force: true,
        })
        .expect(201);

      const scheduleId = schedRes.body.schedule.id;

      const postRes = await request(app.getHttpServer())
        .patch(`/scheduler/schedules/${scheduleId}/posted`)
        .set('x-api-key', apiKey)
        .send({ externalUrl: 'https://instagram.com/p/manual_post_123' })
        .expect(200);

      expect(postRes.body.status).toBe('posted');

      // Check content is now published
      const contentRes = await request(app.getHttpServer())
        .get(`/contents/${f6ContentId}`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(contentRes.body.status).toBe('published');
      expect(contentRes.body.externalUrl).toBe('https://instagram.com/p/manual_post_123');
    });

    it('DELETE /scheduler/schedules/:id should remove schedule and revert content to draft', async () => {
      const scheduleTime = new Date(Date.now() + 1800000).toISOString();
      const schedRes = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .set('x-api-key', apiKey)
        .send({
          contentId: f6ContentId,
          scheduledFor: scheduleTime,
          force: true,
        })
        .expect(201);

      const scheduleId = schedRes.body.schedule.id;

      await request(app.getHttpServer())
        .delete(`/scheduler/schedules/${scheduleId}`)
        .set('x-api-key', apiKey)
        .expect(200);

      // Verify content is back to draft
      const contentRes = await request(app.getHttpServer())
        .get(`/contents/${f6ContentId}`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(contentRes.body.status).toBe('draft');
    });
  });

  describe('Ads Manager & Budget Guard (Fase 7)', () => {
    let f7PlatformId: number;
    let f7ProductId: number;

    beforeEach(async () => {
      const suffix = Math.random().toString(36).substring(2, 9) + Date.now();
      const platRes = await request(app.getHttpServer())
        .post('/platforms')
        .set('x-api-key', apiKey)
        .send({ name: `Platform F7 ${suffix}`, code: `f7_${suffix}` })
        .expect(201);
      f7PlatformId = platRes.body.id;

      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .set('x-api-key', apiKey)
        .send({
          externalId: `ext_f7_${suffix}`,
          name: `Produk Ads ${suffix}`,
          platformId: f7PlatformId,
          price: 120000,
        })
        .expect(201);
      f7ProductId = prodRes.body.id;
    });

    it('POST /ads/campaigns should create campaign and auto-generate unique subId for product', async () => {
      const res = await request(app.getHttpServer())
        .post('/ads/campaigns')
        .set('x-api-key', apiKey)
        .send({
          name: 'Iklan Meta Produk Viral',
          platform: 'meta',
          dailyBudget: 50000,
          productId: f7ProductId,
          notes: 'Testing audience 25-34',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('active');
      expect(res.body.linkId).toBeDefined();
      expect(res.body.link).toBeDefined();
      expect(res.body.link.subId).toBeDefined();
      expect(res.body.link.productId).toBe(f7ProductId);
    });

    it('PUT & GET /ads/budget-rules should configure spending guard caps', async () => {
      const putRes = await request(app.getHttpServer())
        .put('/ads/budget-rules')
        .set('x-api-key', apiKey)
        .send({
          platform: 'meta',
          maxDailySpend: 300000,
          maxMonthlySpend: 8000000,
          isActive: true,
        })
        .expect(200);

      expect(putRes.body.platform).toBe('meta');
      expect(putRes.body.maxDailySpend).toBe(300000);

      const getRes = await request(app.getHttpServer())
        .get('/ads/budget-rules')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(getRes.body)).toBe(true);
      const metaRule = getRes.body.find((r: { platform: string }) => r.platform === 'meta');
      expect(metaRule).toBeDefined();
      expect(metaRule.maxDailySpend).toBe(300000);
    });

    it('POST /ads/campaigns/:id/record-spend should trigger auto-pause when daily budget exceeded', async () => {
      const campRes = await request(app.getHttpServer())
        .post('/ads/campaigns')
        .set('x-api-key', apiKey)
        .send({
          name: 'Iklan TikTok Budget Cap Test',
          platform: 'tiktok',
          dailyBudget: 40000,
          productId: f7ProductId,
        })
        .expect(201);

      const campaignId = campRes.body.id;

      // 1. Spend 20.000 (< 40.000) -> remains active
      const spend1 = await request(app.getHttpServer())
        .post(`/ads/campaigns/${campaignId}/record-spend`)
        .set('x-api-key', apiKey)
        .send({ spend: 20000 })
        .expect(201);

      expect(spend1.body.campaign.status).toBe('active');
      expect(spend1.body.campaign.currentSpend).toBe(20000);

      // 2. Spend another 25.000 (total 45.000 > daily budget 40.000) -> auto pause!
      const spend2 = await request(app.getHttpServer())
        .post(`/ads/campaigns/${campaignId}/record-spend`)
        .set('x-api-key', apiKey)
        .send({ spend: 25000 })
        .expect(201);

      expect(spend2.body.campaign.status).toBe('budget_exceeded');
      expect(spend2.body.campaign.currentSpend).toBe(45000);
      expect(spend2.body.campaign.pausedReason).toContain('Batas budget harian');
    });

    it('PATCH /ads/campaigns/:id/resume & pause should manually toggle campaign status', async () => {
      const campRes = await request(app.getHttpServer())
        .post('/ads/campaigns')
        .set('x-api-key', apiKey)
        .send({
          name: 'Manual Toggle Campaign',
          platform: 'meta',
          dailyBudget: 60000,
          productId: f7ProductId,
        })
        .expect(201);

      const campaignId = campRes.body.id;

      // Pause manually
      const pauseRes = await request(app.getHttpServer())
        .patch(`/ads/campaigns/${campaignId}/pause`)
        .set('x-api-key', apiKey)
        .send({ reason: 'Jeda sementara evaluasi materi' })
        .expect(200);

      expect(pauseRes.body.status).toBe('paused');
      expect(pauseRes.body.pausedReason).toBe('Jeda sementara evaluasi materi');

      // Resume
      const resumeRes = await request(app.getHttpServer())
        .patch(`/ads/campaigns/${campaignId}/resume`)
        .set('x-api-key', apiKey)
        .expect(200);

      expect(resumeRes.body.status).toBe('active');
      expect(resumeRes.body.pausedReason).toBeNull();
    });

    it('POST /ads/guard/run-check should evaluate active campaigns and return guard report', async () => {
      const res = await request(app.getHttpServer())
        .post('/ads/guard/run-check')
        .set('x-api-key', apiKey)
        .expect(201);

      expect(res.body.timestamp).toBeDefined();
      expect(res.body.triggeredPauses).toBeDefined();
      expect(Array.isArray(res.body.evaluations)).toBe(true);
    });

    it('GET /ads/summary should return overall ads performance metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/ads/summary')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(res.body.totalSpend).toBeDefined();
      expect(res.body.totalRevenue).toBeDefined();
      expect(res.body.netProfit).toBeDefined();
      expect(res.body.overallRoas).toBeDefined();
    });
  });

  describe('Analytics & ROI (Fase 8)', () => {
    it('GET /analytics/roi/contents should return content ROI and hourly return metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/roi/contents')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const item = res.body[0];
        expect(item.contentId).toBeDefined();
        expect(item.totalRevenue).toBeDefined();
        expect(item.hourlyReturn).toBeDefined();
        expect(item.productionHours).toBeDefined();
      }
    });

    it('GET /analytics/roi/niches should return grouped category performance', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/roi/niches')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const niche = res.body[0];
        expect(niche.niche).toBeDefined();
        expect(niche.productCount).toBeDefined();
        expect(niche.totalRevenue).toBeDefined();
        expect(niche.avgRevenuePerProduct).toBeDefined();
      }
    });

    it('GET /analytics/roi/platforms should return platform breakdowns', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/roi/platforms')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const plat = res.body[0];
        expect(plat.platformCode).toBeDefined();
        expect(plat.totalRevenue).toBeDefined();
      }
    });

    it('GET /analytics/roi/hourly should return labor efficiency and benchmark comparison', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/roi/hourly')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(res.body.totalHours).toBeDefined();
      expect(res.body.avgHourlyReturn).toBeDefined();
      expect(res.body.benchmark).toBe(50000);
      expect(res.body.efficiencyRatio).toBeDefined();
      expect(res.body.rating).toBeDefined();
    });

    it('GET /analytics/weekly-report should generate performance overview and actionable takeaways', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/weekly-report')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(res.body.period).toBeDefined();
      expect(res.body.currentRevenue).toBeDefined();
      expect(res.body.growthPercent).toBeDefined();
      expect(Array.isArray(res.body.takeaways)).toBe(true);
    });
  });
});
