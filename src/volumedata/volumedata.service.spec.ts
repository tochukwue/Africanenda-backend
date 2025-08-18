import { Test, TestingModule } from '@nestjs/testing';
import { VolumedataService } from './volumedata.service';

describe('VolumedataService', () => {
  let service: VolumedataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VolumedataService],
    }).compile();

    service = module.get<VolumedataService>(VolumedataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
