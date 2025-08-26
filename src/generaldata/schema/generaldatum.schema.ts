import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class GeneralData {
    @Prop() systemName: string;
    @Prop() geographicReach: string;
    @Prop() geographicRegion: string;
    @Prop() coverage: string; // Domestic/Regional
    @Prop() yearOfEstablishment: string;
    @Prop() gender: string;

    @Prop() interoperabilityArrangement: string;
    @Prop() ipsType: string;
    @Prop() governanceTypology: string;
    @Prop() ownershipModel: string;
    @Prop() systemOwner: string;
    @Prop() overseer: string;
    @Prop() systemGovernance: string;
    @Prop() operator: string;
    @Prop() settlementAgent: string;
    @Prop() numberOfUniqueIpsEndUsers: string;
    @Prop() totalNumberOfParticipants2025: string;
    @Prop() numberOfDirectParticipantsCommercialBanks: string;
    @Prop() numberOfDirectParticipantsEMoneyIssuers: string;
    @Prop() numberOfDirectParticipantsMFIs: string;
    @Prop() numberOfDirectParticipantsOther: string;
    @Prop() numberOfDirectParticipantsPostOffice: string;
    @Prop() indirectParticipantsType: string;
    @Prop() numberOfIndirectParticipants: string;
    @Prop() supportedUseCases: string;
    @Prop() supportedInstruments: string;
    @Prop() primaryLocalChannel: string;
    @Prop() supportedChannels: string;
    @Prop() qrCodeEnabledType: string; // Static/dynamic/both
    @Prop() messagingStandard: string;
    @Prop() proxyId: string;
    @Prop() otherProxyIdType: string;
    @Prop() businessModel: string;
    @Prop() pricingStructure: string;
    @Prop() schemeRulesPublic: string;
    @Prop() additionalRecourseRequirements: string;
    @Prop() disputeResolutionMechanism: string;
    @Prop() apiUseFunction: string;
    @Prop() startupFundingSource: string;
    @Prop() participationInDecisionMaking: string;
    @Prop() mechanismForDecisionMaking: string;
    @Prop() abilityToBecomeDirectParticipants: string;
    @Prop() entitiesThatCannotParticipate: string;
    @Prop() nonBankingFIsSponsorship: string;
    @Prop() minValueForTransactions: string;
    @Prop() corporateStructure: string;
    @Prop() otherCorporateStructure: string;
    @Prop() pullRequestToPayEnabled: string;
    @Prop() thirdPartyConnectionsEnabled: string;
    @Prop() realTimePaymentConfirmationEnabled: string;
    @Prop() transactionValidationEnabled: string;
}

export type GeneralDataDocument = GeneralData & Document;
export const GeneralDataSchema = SchemaFactory.createForClass(GeneralData);
