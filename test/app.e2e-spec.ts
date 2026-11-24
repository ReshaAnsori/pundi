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
});
