import { forwardRef, Module } from '@nestjs/common';
import { GeneraldataService } from './generaldata.service';
import { GeneraldataController } from './generaldata.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { GeneralData, GeneralDataSchema } from './schema/generaldatum.schema';
import { GoogleSheetModule } from 'src/google-sheet/google-sheet.module';

@Module({
  imports: [
    forwardRef(() => GoogleSheetModule),
    MongooseModule.forFeature([{ name: GeneralData.name, schema: GeneralDataSchema }]),
    // Importing GoogleSheetModule to use its service
  ],
  controllers: [GeneraldataController],
  providers: [GeneraldataService],
})
export class GeneraldataModule { }
