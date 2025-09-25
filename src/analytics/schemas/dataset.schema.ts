import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DatasetDocument = Dataset & Document;

@Schema({ timestamps: true })
export class Dataset {
  @Prop({ required: true, unique: true })
  name: string; // e.g. "population_data", "gdp_dataset"

  @Prop({ required: true })
  link: string; // e.g. Google Sheets, S3, or any external URL
}

export const DatasetSchema = SchemaFactory.createForClass(Dataset);
