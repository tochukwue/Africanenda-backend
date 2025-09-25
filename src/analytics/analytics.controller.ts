import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { LogEventDto, LogIndicatorDto } from './dto/analytics.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  // ✅ Log analytics event
  @Post('event')
  @ApiOperation({ summary: 'Log an analytics event (userId optional)' })
  @ApiResponse({ status: 201, description: 'Event logged successfully' })
  async logEvent(@Body() dto: LogEventDto) {
    return this.analyticsService.recordEvent(dto.event as any, dto.userId);
  }

  // ✅ Get analytics stats
  @Get('stats')
  @ApiOperation({ summary: 'Get totals & percentage change between two dates' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date in YYYY-MM-DD format',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date in YYYY-MM-DD format',
    example: '2025-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated analytics stats with percentage changes',
    schema: {
      example: {
        totals: {
          uniqueVisitors: 100,
          sessions: 200,
          landingPageEngagement: 50,
          transactionExplorerCount: 80,
          transactionVolumeViews: 40,
          transactionValueViews: 60,
          profilePageViews: 90,
        },
        percentageChange: {
          uniqueVisitors: '+20%',
          sessions: '-10%',
          landingPageEngagement: '+5%',
          transactionExplorerCount: '0%',
          transactionVolumeViews: '+50%',
          transactionValueViews: '-15%',
          profilePageViews: '+30%',
        },
      },
    },
  })
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getStats(new Date(startDate), new Date(endDate));
  }


   @Get('stats/range')
  @ApiOperation({ summary: 'Get totals & percentage change by date range' })
  @ApiQuery({
    name: 'range',
    required: true,
    description:
      'Date range for analytics. Allowed values: 7days, thisMonth, lastMonth, thisYear, last2Years, last6Months',
    enum: [
      '7days',
      'thisMonth',
      'lastMonth',
      'thisYear',
      'last2Years',
      'last6Months',
    ],
    example: '7days',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated analytics stats with percentage changes',
    schema: {
      example: {
        totals: {
          uniqueVisitors: 100,
          sessions: 200,
          landingPageEngagement: 50,
          transactionExplorerCount: 80,
          transactionVolumeViews: 40,
          transactionValueViews: 60,
          profilePageViews: 90,
        },
        percentageChange: {
          uniqueVisitors: '+20%',
          sessions: '-10%',
          landingPageEngagement: '+5%',
          transactionExplorerCount: '0%',
          transactionVolumeViews: '+50%',
          transactionValueViews: '-15%',
          profilePageViews: '+30%',
        },
      },
    },
  })
  async getStatsRange(@Query('range') range: string) {
    return this.analyticsService.getStatsRange(range);
  }

  // ✅ Log indicator call
  @Post('indicator')
  @ApiOperation({ summary: 'Log an indicator call' })
  @ApiResponse({ status: 201, description: 'Indicator call logged successfully' })
  async logIndicator(@Body() dto: LogIndicatorDto) {
    return this.analyticsService.logIndicatorCall(dto.indicatorName);
  }

  // ✅ Get indicator stats
  @Get('indicator-stats')
  @ApiOperation({ summary: 'Get indicator call counts sorted by highest usage' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date in YYYY-MM-DD format',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date in YYYY-MM-DD format',
    example: '2025-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated indicator stats',
    schema: {
      example: [
        { _id: 'GDP Growth', totalCount: 120 },
        { _id: 'Inflation Rate', totalCount: 80 },
        { _id: 'Unemployment Rate', totalCount: 45 },
      ],
    },
  })
  async getIndicatorStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getIndicatorStats(
      new Date(startDate),
      new Date(endDate),
    );
  }

   @Get('indicator/stats/range')
  @ApiOperation({ summary: 'Get indicator call counts sorted by highest usage' })
  @ApiQuery({
    name: 'range',
    required: true,
    description:
      'Date range for indicator stats. Allowed values: 7days, thisMonth, lastMonth, thisYear, last2Years, last6Months',
    enum: [
      '7days',
      'thisMonth',
      'lastMonth',
      'thisYear',
      'last2Years',
      'last6Months',
    ],
    example: 'thisMonth',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated indicator stats sorted by highest usage',
    schema: {
      example: [
        { _id: 'GDP Growth', totalCount: 120 },
        { _id: 'Inflation Rate', totalCount: 80 },
        { _id: 'Unemployment Rate', totalCount: 45 },
      ],
    },
  })
  async getIndicatorStatsRange(@Query('range') range: string) {
    return this.analyticsService.getIndicatorStatsRange(range);
  }





  @Post('link/upsert')
  @ApiOperation({ summary: 'Create or update a dataset link' })
  @ApiResponse({
    status: 201,
    description: 'Dataset link created/updated successfully',
    schema: {
      example: {
        name: 'gdp_dataset',
        link: 'https://docs.google.com/spreadsheets/d/xxxx',
      },
    },
  })
  async upsertDataset(
    @Body('name') name: string,
    @Body('link') link: string,
  ) {
    return this.analyticsService.upsertDataset(name, link);
  }

  @Get('link/data/:name')
  @ApiOperation({ summary: 'Get dataset link by name' })
  @ApiResponse({
    status: 200,
    description: 'Dataset fetched successfully',
    schema: {
      example: {
        name: 'population_data',
        link: 'https://drive.google.com/sheet/yyy',
      },
    },
  })
  async getDataset(@Param('name') name: string) {
    return this.analyticsService.getDataset(name);
  }

}
