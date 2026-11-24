import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) should return 200 without API key', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        database: 'connected',
      });
  });

  it('/ (GET) should return 401 without API key', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/ (GET) should return 200 with valid x-api-key', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('x-api-key', 'pundi-secret-api-key')
      .expect(200)
      .expect('Hello World!');
  });
});
