import { Test, TestingModule } from '@nestjs/testing';
import { IpslistController } from './ipslist.controller';
import { IpslistService } from './ipslist.service';

describe('IpslistController', () => {
  let controller: IpslistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IpslistController],
      providers: [IpslistService],
    }).compile();

    controller = module.get<IpslistController>(IpslistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
