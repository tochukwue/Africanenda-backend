import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Analytics, AnalyticsSchema } from './schemas/analytics.schema';
import { IndicatorTracking, IndicatorTrackingSchema } from './schemas/indicator-tracking.schema';
import { Dataset, DatasetSchema } from './schemas/dataset.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Analytics.name, schema: AnalyticsSchema }, { name: IndicatorTracking.name, schema: IndicatorTrackingSchema },{ name: Dataset.name, schema: DatasetSchema }]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService], // optional: export service if needed elsewhere
})
export class AnalyticsModule { }
