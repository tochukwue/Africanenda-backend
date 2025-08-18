import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VolumeDataDocument = VolumeData & Document;

@Schema({ timestamps: true })
export class VolumeData {
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

export const VolumeDataSchema = SchemaFactory.createForClass(VolumeData);
