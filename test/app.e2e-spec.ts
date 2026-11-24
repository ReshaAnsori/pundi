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
});
