import { Module } from '@nestjs/common';
import { GoogleSheetService } from './google-sheet.service';
import { GoogleSheetController } from './google-sheet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { GeneralData, GeneralDataSchema } from 'src/generaldata/schema/generaldatum.schema';
import { VolumeData, VolumeDataSchema } from 'src/volumedata/schema/volumedatum.schema';
import { ValueData, ValueDataSchema } from 'src/valuedata/schema/valuedatum.schema';
import { FrenchGeneralData, FrenchGeneralDataSchema } from 'src/generaldata/schema/frgeneraldatum.schema';
import { FrenchVolumeData, FrenchVolumeDataSchema } from 'src/volumedata/schema/frvolumedatum.schema';
import { FrenchValueData, FrenchValueDataSchema } from 'src/valuedata/schema/frvaluedatum.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GeneralData.name, schema: GeneralDataSchema },
      { name: FrenchGeneralData.name, schema: FrenchGeneralDataSchema },
    { name: VolumeData.name, schema: VolumeDataSchema },
     { name: FrenchVolumeData.name, schema: FrenchVolumeDataSchema },
    { name: ValueData.name, schema: ValueDataSchema },
   { name: FrenchValueData.name, schema: FrenchValueDataSchema },
  ]),
    // Importing GoogleSheetModule to use its service
  ],
  controllers: [GoogleSheetController],
  providers: [GoogleSheetService],
  exports: [GoogleSheetService],
})
export class GoogleSheetModule { }
