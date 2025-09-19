// src/analytics/schemas/analytics.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalyticsDocument = Analytics & Document;

@Schema({ timestamps: true })
export class Analytics {
  @Prop({ required: true, unique: true })
  date: string; // YYYY-MM-DD

  // optional list of userIds seen that day (used to compute uniqueVisitors)
  @Prop({ type: [String], default: [] })
  userIds?: string[];

  @Prop({ default: 0 })
  uniqueVisitors: number;

  @Prop({ default: 0 })
  sessions: number;

  @Prop({ default: 0 })
  landingPageEngagement: number;

  @Prop({ default: 0 })
  transactionExplorerCount: number;

  @Prop({ default: 0 })
  transactionVolumeViews: number;

  @Prop({ default: 0 })
  transactionValueViews: number;

  @Prop({ default: 0 })
  profilePageViews: number;
}

export const AnalyticsSchema = SchemaFactory.createForClass(Analytics);
