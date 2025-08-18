import { Test, TestingModule } from '@nestjs/testing';
import { ValuedataService } from './valuedata.service';

describe('ValuedataService', () => {
  let service: ValuedataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValuedataService],
    }).compile();

    service = module.get<ValuedataService>(ValuedataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
