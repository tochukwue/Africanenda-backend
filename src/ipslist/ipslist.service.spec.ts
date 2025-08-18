import { Test, TestingModule } from '@nestjs/testing';
import { IpslistService } from './ipslist.service';

describe('IpslistService', () => {
  let service: IpslistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IpslistService],
    }).compile();

    service = module.get<IpslistService>(IpslistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
