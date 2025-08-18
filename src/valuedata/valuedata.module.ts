import { forwardRef, Module } from '@nestjs/common';
import { ValuedataService } from './valuedata.service';
import { ValuedataController } from './valuedata.controller';
import { ValueData, ValueDataSchema } from './schema/valuedatum.schema';
import { GoogleSheetModule } from 'src/google-sheet/google-sheet.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
      imports: [
          forwardRef(() => GoogleSheetModule),
        MongooseModule.forFeature([{ name: ValueData.name, schema: ValueDataSchema }]),
        // Importing GoogleSheetModule to use its service
      ],
  controllers: [ValuedataController],
  providers: [ValuedataService],
})
export class ValuedataModule {}
