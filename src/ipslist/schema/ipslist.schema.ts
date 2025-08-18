import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IpsActivityDocument = IpsActivity & Document;

@Schema({ timestamps: true })
export class IpsActivity {
  @Prop({ required: true })
  country: string;

  @Prop({
    required: true,
    enum: [
      'LIVE: DOMESTIC IPS',
      'DOMESTIC: IN DEVELOPMENT',
      'Countries with no domestic IPS activity',
      'LIVE: REGIONAL IPS',
      'REGIONAL: IN DEVELOPMENT',
      'IN PILOT PHASE',
      'Countries with no regional IPS activity',
    ],
  })
  category: string;

  @Prop() ipsName?: string;
  @Prop() geography?: string;
  @Prop() region?: string;
  @Prop() ipsType?: string;
  @Prop() status?: string;
  @Prop() geographyCountries?: string;
}

export const IpsActivitySchema = SchemaFactory.createForClass(IpsActivity);
