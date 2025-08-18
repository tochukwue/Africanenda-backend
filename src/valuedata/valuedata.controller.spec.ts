import { Test, TestingModule } from '@nestjs/testing';
import { ValuedataController } from './valuedata.controller';
import { ValuedataService } from './valuedata.service';

describe('ValuedataController', () => {
  let controller: ValuedataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValuedataController],
      providers: [ValuedataService],
    }).compile();

    controller = module.get<ValuedataController>(ValuedataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
