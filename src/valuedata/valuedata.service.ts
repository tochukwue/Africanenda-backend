import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleSheetService } from 'src/google-sheet/google-sheet.service';
import { ValueData, ValueDataDocument } from './schema/valuedatum.schema';

@Injectable()
export class ValuedataService {
  constructor(
    private readonly googleSheetService: GoogleSheetService,
    @InjectModel(ValueData.name)
    private readonly valueDataModel: Model<ValueDataDocument>,
  ) {}

  // 🔄 Auto sync every hour
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    await this.googleSheetService.fetchAndSyncValueData();
  }

  // 📌 Manual sync endpoint call
  async syncFromGoogleSheet() {
    return this.googleSheetService.fetchAndSyncValueData();
  }

    async FrenchsyncFromGoogleSheet() {
    return this.googleSheetService.FrenchfetchAndSyncValueData();
  }
  // 📂 Get all value data
  async findAll(): Promise<ValueData[]> {
    return this.valueDataModel.find().exec();
  }
}
