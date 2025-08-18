import { Test, TestingModule } from '@nestjs/testing';
import { GoogleSheetController } from './google-sheet.controller';
import { GoogleSheetService } from './google-sheet.service';

describe('GoogleSheetController', () => {
  let controller: GoogleSheetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleSheetController],
      providers: [GoogleSheetService],
    }).compile();

    controller = module.get<GoogleSheetController>(GoogleSheetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
