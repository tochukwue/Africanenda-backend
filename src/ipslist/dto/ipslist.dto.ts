
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO for filters
export class FiltersDto {
  @ApiProperty({
    example: ['Kenya', 'Nigeria'],
    description: 'Geographic reach to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geographicReach?: string[];

  @ApiProperty({
    example: ['East Africa', 'West Africa'],
    description: 'Geographic region to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  geographicRegion?: string[];

  @ApiProperty({
    example: ['Domestic', 'Regional'],
    description: 'Coverage type to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverage?: string[];

  @ApiProperty({
    example: ['2018', '2020'],
    description: 'Year of establishment to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  yearOfEstablishment?: string[];

  @ApiProperty({
    example: ['Real-time', 'Batch'],
    description: 'IPS type to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipsType?: string[];

  @ApiProperty({
    example: ['Bilateral', 'Multilateral'],
    description: 'Interoperability arrangement to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interoperabilityArrangement?: string[];

  @ApiProperty({
    example: ['Public', 'Private'],
    description: 'Governance typology to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  governanceTypology?: string[];

  @ApiProperty({
    example: ['Government', 'Private Sector'],
    description: 'Ownership model to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ownershipModel?: string[];

  @ApiProperty({
    example: ['Central Bank', 'Commercial Bank'],
    description: 'System owner to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemOwner?: string[];

  @ApiProperty({
    example: ['Central Bank', 'Financial Regulator'],
    description: 'Overseer to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  overseer?: string[];

  @ApiProperty({
    example: ['Board of Directors', 'Committee'],
    description: 'System governance to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemGovernance?: string[];

  @ApiProperty({
    example: ['Third Party', 'Central Bank'],
    description: 'Operator to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operator?: string[];

  @ApiProperty({
    example: ['Central Bank', 'Commercial Bank'],
    description: 'Settlement agent to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  settlementAgent?: string[];

  @ApiProperty({
    example: ['1000000', '5000000'],
    description: 'Number of unique IPS end users to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfUniqueIpsEndUsers?: string[];

  @ApiProperty({
    example: ['50', '100'],
    description: 'Total number of participants 2025 to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  totalNumberOfParticipants2025?: string[];

  @ApiProperty({
    example: ['10', '25'],
    description: 'Number of direct participants - commercial banks to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfDirectParticipantsCommercialBanks?: string[];

  @ApiProperty({
    example: ['5', '15'],
    description: 'Number of direct participants - e-money issuers to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfDirectParticipantsEMoneyIssuers?: string[];

  @ApiProperty({
    example: ['3', '8'],
    description: 'Number of direct participants - MFIs to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfDirectParticipantsMFIs?: string[];

  @ApiProperty({
    example: ['2', '5'],
    description: 'Number of direct participants - other to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfDirectParticipantsOther?: string[];

  @ApiProperty({
    example: ['1', '3'],
    description: 'Number of direct participants - post office to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfDirectParticipantsPostOffice?: string[];

  @ApiProperty({
    example: ['Agents', 'Sub-branches'],
    description: 'Indirect participants type to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indirectParticipantsType?: string[];

  @ApiProperty({
    example: ['1000', '5000'],
    description: 'Number of indirect participants to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numberOfIndirectParticipants?: string[];

  @ApiProperty({
    example: ['P2P', 'Retail', 'Bill Payment'],
    description: 'Supported use cases to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedUseCases?: string[];

  @ApiProperty({
    example: ['Credit Transfer', 'Direct Debit'],
    description: 'Supported instruments to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedInstruments?: string[];

  @ApiProperty({
    example: ['Mobile App', 'USSD'],
    description: 'Primary local channel to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryLocalChannel?: string[];

  @ApiProperty({
    example: ['Mobile App', 'Internet Banking', 'ATM'],
    description: 'Supported channels to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedChannels?: string[];

  @ApiProperty({
    example: ['Static', 'Dynamic', 'Both'],
    description: 'QR code enabled type to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qrCodeEnabledType?: string[];

  @ApiProperty({
    example: ['ISO 20022', 'Proprietary'],
    description: 'Messaging standard to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messagingStandard?: string[];

  @ApiProperty({
    example: ['Phone Number', 'Email', 'Account Number'],
    description: 'Proxy ID to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proxyId?: string[];

  @ApiProperty({
    example: ['QR Code', 'NFC'],
    description: 'Other proxy ID type to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherProxyIdType?: string[];

  @ApiProperty({
    example: ['Fee-based', 'Revenue Sharing'],
    description: 'Business model to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessModel?: string[];

  @ApiProperty({
    example: ['Flat Fee', 'Percentage'],
    description: 'Pricing structure to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pricingStructure?: string[];

  @ApiProperty({
    example: ['Yes', 'No'],
    description: 'Scheme rules public to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schemeRulesPublic?: string[];

  @ApiProperty({
    example: ['Insurance', 'Guarantee'],
    description: 'Additional recourse requirements to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalRecourseRequirements?: string[];

  @ApiProperty({
    example: ['Arbitration', 'Court System'],
    description: 'Dispute resolution mechanism to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disputeResolutionMechanism?: string[];

  @ApiProperty({
    example: ['Payment', 'Account Information'],
    description: 'API use function to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apiUseFunction?: string[];

  @ApiProperty({
    example: ['Government', 'Private Investment'],
    description: 'Startup funding source to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  startupFundingSource?: string[];

  @ApiProperty({
    example: ['Board Representation', 'Voting Rights'],
    description: 'Participation in decision making to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participationInDecisionMaking?: string[];

  @ApiProperty({
    example: ['Consensus', 'Majority Vote'],
    description: 'Mechanism for decision making to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mechanismForDecisionMaking?: string[];

  @ApiProperty({
    example: ['Open Access', 'Restricted'],
    description: 'Ability to become direct participants to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  abilityToBecomeDirectParticipants?: string[];

  @ApiProperty({
    example: ['None', 'Foreign Banks'],
    description: 'Entities that cannot participate to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entitiesThatCannotParticipate?: string[];

  @ApiProperty({
    example: ['Required', 'Not Required'],
    description: 'Non-banking FIs sponsorship to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nonBankingFIsSponsorship?: string[];

  @ApiProperty({
    example: ['0', '100'],
    description: 'Minimum value for transactions to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  minValueForTransactions?: string[];

  @ApiProperty({
    example: ['Limited Company', 'Partnership'],
    description: 'Corporate structure to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  corporateStructure?: string[];

  @ApiProperty({
    example: ['Cooperative', 'Trust'],
    description: 'Other corporate structure to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherCorporateStructure?: string[];

  @ApiProperty({
    example: ['Yes', 'No'],
    description: 'Pull request to pay enabled to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pullRequestToPayEnabled?: string[];

  @ApiProperty({
    example: ['Yes', 'No'],
    description: 'Third party connections enabled to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  thirdPartyConnectionsEnabled?: string[];

  @ApiProperty({
    example: ['Yes', 'No'],
    description: 'Real time payment confirmation enabled to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  realTimePaymentConfirmationEnabled?: string[];

  @ApiProperty({
    example: ['Yes', 'No'],
    description: 'Transaction validation enabled to filter by',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transactionValidationEnabled?: string[];
}

// Main request DTO
export class GetByCategoriesDto {
  @ApiProperty({
    example: [
      'LIVE: DOMESTIC IPS',
      'DOMESTIC: IN DEVELOPMENT',
      'Countries with no domestic IPS activity',
    ],
    description: 'List of categories to filter by',
  })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiProperty({
    type: FiltersDto,
    description: 'Optional filters (only applied when category includes "LIVE: DOMESTIC IPS")',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FiltersDto)
  filters?: FiltersDto;

    @ApiPropertyOptional({
    description: 'Optional filter for ipsName (applies only to regional categories).',
    type: [String],
    example: ['PAPSS', 'SEPA'],
  })
  ipsNameFilter?: string[] | string;
}


export class CreateIpslistDto {}
