import { Test, TestingModule } from '@nestjs/testing';
import { GeneraldataService } from './generaldata.service';

describe('GeneraldataService', () => {
  let service: GeneraldataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeneraldataService],
    }).compile();

    service = module.get<GeneraldataService>(GeneraldataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
