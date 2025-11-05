import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleSheetService } from 'src/google-sheet/google-sheet.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GeneralData, GeneralDataDocument } from './schema/generaldatum.schema';


@Injectable()
export class GeneraldataService {
  constructor(
    private readonly googleSheetService: GoogleSheetService,
    @InjectModel(GeneralData.name)
    private readonly generalDataModel: Model<GeneralDataDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    await this.googleSheetService.fetchAndSyncGeneralData();
    await this.googleSheetService.FrenchfetchAndSyncGeneralData();
  }

    // 📌 Manual sync function
  async syncFromGoogleSheet() {
    return this.googleSheetService.fetchAndSyncGeneralData();
  }

    async FrenchfetchAndSyncGeneralData() {
    return this.googleSheetService.FrenchfetchAndSyncGeneralData();
  }
  
  // ✅ New function to fetch all records
  async findAll(): Promise<GeneralData[]> {
    return this.generalDataModel.find().exec();
  }
}
