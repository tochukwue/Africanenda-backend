import { Test, TestingModule } from '@nestjs/testing';
import { GeneraldataController } from './generaldata.controller';
import { GeneraldataService } from './generaldata.service';

describe('GeneraldataController', () => {
  let controller: GeneraldataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneraldataController],
      providers: [GeneraldataService],
    }).compile();

    controller = module.get<GeneraldataController>(GeneraldataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
