import { Module } from '@nestjs/common';
import { GoogleSheetService } from './google-sheet.service';
import { GoogleSheetController } from './google-sheet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { GeneralData, GeneralDataSchema } from 'src/generaldata/schema/generaldatum.schema';
import { VolumeData, VolumeDataSchema } from 'src/volumedata/schema/volumedatum.schema';
import { ValueData, ValueDataSchema } from 'src/valuedata/schema/valuedatum.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GeneralData.name, schema: GeneralDataSchema },
    { name: VolumeData.name, schema: VolumeDataSchema },
    { name: ValueData.name, schema: ValueDataSchema }]),
    // Importing GoogleSheetModule to use its service
  ],
  controllers: [GoogleSheetController],
  providers: [GoogleSheetService],
  exports: [GoogleSheetService],
})
export class GoogleSheetModule { }
