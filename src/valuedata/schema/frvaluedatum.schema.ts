import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FrenchValueDataDocument = FrenchValueData & Document;

@Schema({ timestamps: true })
export class FrenchValueData {
 @Prop() systemName: string;
  @Prop() geographicReach: string;
  @Prop() ipsType: string;
  @Prop() exchangeRate: string;

  @Prop() values2020?: string;
  @Prop() values2021?: string;
  @Prop() values2022?: string;
  @Prop() values2023?: string;
  @Prop() values2024?: string;
  @Prop() values2025?: string;
}

export const FrenchValueDataSchema = SchemaFactory.createForClass(FrenchValueData);
