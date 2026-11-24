import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: { $queryRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaService = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health status with database connected', async () => {
    const result = await controller.check();
    expect(result).toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(prismaService.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
  });
});
