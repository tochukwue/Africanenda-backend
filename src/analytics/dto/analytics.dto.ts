import { ApiProperty } from '@nestjs/swagger';

export class LogEventDto {
  @ApiProperty({
    description: 'Name of the event to log',
    example: 'sessions',
    enum: [
      'uniqueVisitors',
      'sessions',
      'landingPageEngagement',
      'transactionExplorerCount',
      'transactionVolumeViews',
      'transactionValueViews',
      'profilePageViews',
    ],
  })
  event: string;

  @ApiProperty({
    description: 'Optional userId (anonymous if omitted)',
    example: '64f1b5d6c2a1e8b123456789',
    required: false,
  })
  userId?: string;
}

export class LogIndicatorDto {
  @ApiProperty({
    description: 'Name of the indicator being tracked',
    example: 'eKash',
  })
  indicatorName: string;
}

export class UpsertDatasetDto {
  @ApiProperty({
    description: 'Unique name for the dataset',
    example: 'gdp_dataset',
  })
  name: string;

  @ApiProperty({
    description: 'Link to the dataset (Google Sheet, S3, etc.)',
    example: 'https://docs.google.com/spreadsheets/d/xxxx',
  })
  link: string;
}

export class CreateAnalyticsDto {
  // If you want, you can define additional fields for future extension
}
