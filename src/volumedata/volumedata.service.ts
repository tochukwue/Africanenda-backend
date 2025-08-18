import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleSheetService } from 'src/google-sheet/google-sheet.service';
import { VolumeData, VolumeDataDocument } from './schema/volumedatum.schema';

@Injectable()
export class VolumedataService {
  constructor(
    private readonly googleSheetService: GoogleSheetService,
    @InjectModel(VolumeData.name)
    private readonly volumeDataModel: Model<VolumeDataDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    await this.googleSheetService.fetchAndSyncVolumeData();
  }

      // 📌 Manual sync function
  async syncFromGoogleSheet() {
    return this.googleSheetService.fetchAndSyncVolumeData();
  }

  async findAll(): Promise<VolumeData[]> {
    return this.volumeDataModel.find().exec();
  }
}
