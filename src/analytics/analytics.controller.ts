import { Controller, Post, Body, Get, Query } from '@nestjs/common';
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
}
