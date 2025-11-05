import { forwardRef, Module } from '@nestjs/common';
import { IpslistService } from './ipslist.service';
import { IpslistController } from './ipslist.controller';
import { IpsActivity, IpsActivitySchema } from './schema/ipslist.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleSheetModule } from 'src/google-sheet/google-sheet.module';
import { ValueData, ValueDataSchema } from 'src/valuedata/schema/valuedatum.schema';
import { GeneralData, GeneralDataSchema } from 'src/generaldata/schema/generaldatum.schema';
import { VolumeData, VolumeDataSchema } from 'src/volumedata/schema/volumedatum.schema';
import { FrenchGeneralData, FrenchGeneralDataSchema } from 'src/generaldata/schema/frgeneraldatum.schema';
import { FrenchVolumeData, FrenchVolumeDataSchema } from 'src/volumedata/schema/frvolumedatum.schema';
import { FrenchValueData, FrenchValueDataSchema } from 'src/valuedata/schema/frvaluedatum.schema';
import { FrenchIpsActivity, FrenchIpsActivitySchema } from './schema/fripslist.schema';

@Module({
  imports: [
    forwardRef(() => GoogleSheetModule),
    MongooseModule.forFeature([{ name: IpsActivity.name, schema: IpsActivitySchema }, { name: ValueData.name, schema: ValueDataSchema },
    { name: VolumeData.name, schema: VolumeDataSchema }, { name: GeneralData.name, schema: GeneralDataSchema },
////////////////////////////FRENCH/////////////////////////////////////////
    { name: FrenchIpsActivity.name, schema: FrenchIpsActivitySchema },

    { name: FrenchGeneralData.name, schema: FrenchGeneralDataSchema },

    { name: FrenchVolumeData.name, schema: FrenchVolumeDataSchema },

    { name: FrenchValueData.name, schema: FrenchValueDataSchema },
    ]),
    // Importing GoogleSheetModule to use its service
  ],
  controllers: [IpslistController],
  providers: [IpslistService],
})
export class IpslistModule { }
