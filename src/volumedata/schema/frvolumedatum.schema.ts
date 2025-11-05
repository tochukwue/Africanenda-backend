import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FrenchVolumeDataDocument = FrenchVolumeData & Document;

@Schema({ timestamps: true })
export class FrenchVolumeData {
  @Prop() systemName: string;
  @Prop() geographicReach: string;
  @Prop() ipsType: string;

  @Prop() volumes2020?: string;
  @Prop() volumes2021?: string;
  @Prop() volumes2022?: string;
  @Prop() volumes2023?: string;
  @Prop() volumes2024?: string;
  @Prop() volumes2025?: string;


}

export const FrenchVolumeDataSchema = SchemaFactory.createForClass(FrenchVolumeData);
