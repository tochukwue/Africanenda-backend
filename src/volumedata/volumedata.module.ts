import { forwardRef, Module } from '@nestjs/common';
import { VolumedataService } from './volumedata.service';
import { VolumedataController } from './volumedata.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { VolumeData, VolumeDataSchema } from './schema/volumedatum.schema';
import { GoogleSheetModule } from 'src/google-sheet/google-sheet.module';

@Module({
    imports: [
        forwardRef(() => GoogleSheetModule),
      MongooseModule.forFeature([{ name: VolumeData.name, schema: VolumeDataSchema }]),
      // Importing GoogleSheetModule to use its service
    ],
  controllers: [VolumedataController],
  providers: [VolumedataService],
})
export class VolumedataModule {}
