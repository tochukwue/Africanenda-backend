import { Test, TestingModule } from '@nestjs/testing';
import { VolumedataController } from './volumedata.controller';
import { VolumedataService } from './volumedata.service';

describe('VolumedataController', () => {
  let controller: VolumedataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolumedataController],
      providers: [VolumedataService],
    }).compile();

    controller = module.get<VolumedataController>(VolumedataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
