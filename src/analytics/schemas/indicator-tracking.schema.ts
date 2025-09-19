import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IndicatorTrackingDocument = IndicatorTracking & Document;

@Schema({ timestamps: true })
export class IndicatorTracking {
  @Prop({ required: true })
  indicatorName: string; // e.g., "GDP Growth", "Inflation Rate"

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ default: 0 })
  count: number; // how many times indicator was called that day
}

export const IndicatorTrackingSchema =
  SchemaFactory.createForClass(IndicatorTracking);

// 🔑 ensure uniqueness per indicator per day
IndicatorTrackingSchema.index({ indicatorName: 1, date: 1 }, { unique: true });
