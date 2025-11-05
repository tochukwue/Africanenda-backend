import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FrenchIpsActivityDocument = FrenchIpsActivity & Document;

@Schema({ timestamps: true })
export class FrenchIpsActivity {

    @Prop({ required: true })
    country: string;

    @Prop({
        required: true,
        enum: [
            'EN SERVICE : IPS NATIONAUX',
            'DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
            `Pays n'ayant pas d'activité IPS au niveau national`,
            'EN SERVICE: IPS RÉGIONAL',
            'RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
            'EN PHASE PILOTE',
            `Pays n'ayant pas d'activité régionale en matière d'IPS`,
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

export const FrenchIpsActivitySchema = SchemaFactory.createForClass(FrenchIpsActivity);
