import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Analytics, AnalyticsDocument } from './schemas/analytics.schema';
import { IndicatorTracking, IndicatorTrackingDocument } from './schemas/indicator-tracking.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Analytics.name) private analyticsModel: Model<AnalyticsDocument>,
    @InjectModel(IndicatorTracking.name) private readonly indicatorModel: Model<IndicatorTrackingDocument>,
  ) { }

  // allowed events (use exact keys from schema)
  private readonly allowedEvents = [
    'uniqueVisitors',
    'sessions',
    'landingPageEngagement',
    'transactionExplorerCount',
    'transactionVolumeViews',
    'transactionValueViews',
    'profilePageViews',
  ] as const;

  async recordEvent(
    event: typeof this.allowedEvents[number],
    userId?: string,
  ): Promise<AnalyticsDocument> {
    if (!this.allowedEvents.includes(event)) {
      throw new BadRequestException(
        `Invalid event. Allowed events: ${this.allowedEvents.join(', ')}`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const update: any = {
      $inc: { [event]: 1 },
      $setOnInsert: { date: today }, // ✅ only set immutable field(s)
    };

    if (userId) {
      update.$addToSet = { userIds: String(userId).trim() };
    }

    const analytics = await this.analyticsModel.findOneAndUpdate(
      { date: today },
      update,
      { new: true, upsert: true },
    ).exec();

    // ✅ reconcile uniqueVisitors from array length
    if (userId && analytics) {
      const count = Array.isArray(analytics.userIds)
        ? analytics.userIds.length
        : 0;
      if (analytics.uniqueVisitors !== count) {
        analytics.uniqueVisitors = count;
        await analytics.save();
      }
    }

    return analytics;
  }


  private sumMetrics(docs: AnalyticsDocument[]) {
    return docs.reduce(
      (acc, doc) => {
        acc.uniqueVisitors += doc.uniqueVisitors || 0;
        acc.sessions += doc.sessions || 0;
        acc.landingPageEngagement += doc.landingPageEngagement || 0;
        acc.transactionExplorerCount += doc.transactionExplorerCount || 0;
        acc.transactionVolumeViews += doc.transactionVolumeViews || 0;
        acc.transactionValueViews += doc.transactionValueViews || 0;
        acc.profilePageViews += doc.profilePageViews || 0;
        return acc;
      },
      {
        uniqueVisitors: 0,
        sessions: 0,
        landingPageEngagement: 0,
        transactionExplorerCount: 0,
        transactionVolumeViews: 0,
        transactionValueViews: 0,
        profilePageViews: 0,
      },
    );
  }

  private calculatePercentageChange(previous: number, current: number) {
    if (previous === 0 && current === 0) return '0%';
    if (previous === 0) return '+100%';
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
  }

  async getStats(startDate: Date, endDate: Date) {
    // Previous period (same length as date range)
    const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(startDate);
    prevStart.setDate(startDate.getDate() - rangeDays);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(startDate.getDate() - 1);

    // Fetch docs
    const currentDocs = await this.analyticsModel.find({
      date: { $gte: startDate.toISOString().split('T')[0], $lte: endDate.toISOString().split('T')[0] },
    });

    const prevDocs = await this.analyticsModel.find({
      date: { $gte: prevStart.toISOString().split('T')[0], $lte: prevEnd.toISOString().split('T')[0] },
    });

    const currentTotals = this.sumMetrics(currentDocs);
    const prevTotals = this.sumMetrics(prevDocs);

    const percentageChange = Object.keys(currentTotals).reduce((acc, key) => {
      acc[key] = this.calculatePercentageChange(prevTotals[key], currentTotals[key]);
      return acc;
    }, {} as Record<string, string>);

    return { totals: currentTotals, percentageChange };
  }

  async getStatsRange(range: string) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (range) {
      case '7days':
        startDate = new Date();
        startDate.setDate(now.getDate() - 6); // last 7 days including today
        break;

      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;

      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // last day of last month
        break;

      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;

      case 'last2Years':
        startDate = new Date(now.getFullYear() - 2, 0, 1);
        break;

      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;

      default:
        throw new Error(
          'Invalid range. Allowed values: 7days, thisMonth, lastMonth, thisYear, last2Years, last6Months',
        );
    }

    // Previous period (same length as date range)
    const rangeDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const prevStart = new Date(startDate);
    prevStart.setDate(startDate.getDate() - rangeDays);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(startDate.getDate() - 1);

    // Fetch docs
    const currentDocs = await this.analyticsModel.find({
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0],
      },
    });

    const prevDocs = await this.analyticsModel.find({
      date: {
        $gte: prevStart.toISOString().split('T')[0],
        $lte: prevEnd.toISOString().split('T')[0],
      },
    });

    const currentTotals = this.sumMetrics(currentDocs);
    const prevTotals = this.sumMetrics(prevDocs);

    const percentageChange = Object.keys(currentTotals).reduce((acc, key) => {
      acc[key] = this.calculatePercentageChange(
        prevTotals[key],
        currentTotals[key],
      );
      return acc;
    }, {} as Record<string, string>);

    return { range, startDate, endDate, totals: currentTotals, percentageChange };
  }



  // ✅ log indicator call
  async logIndicatorCall(indicatorName: string) {
    if (!indicatorName) {
      throw new BadRequestException('Indicator name is required');
    }

    const today = new Date().toISOString().slice(0, 10);

    return this.indicatorModel.findOneAndUpdate(
      { indicatorName, date: today },
      { $inc: { count: 1 }, $setOnInsert: { date: today, indicatorName } },
      { new: true, upsert: true },
    ).exec();
  }

  // ✅ get stats between two dates, sorted by highest count
  async getIndicatorStats(startDate: Date, endDate: Date) {
    return this.indicatorModel.aggregate([
      {
        $match: {
          date: {
            $gte: startDate.toISOString().slice(0, 10),
            $lte: endDate.toISOString().slice(0, 10),
          },
        },
      },
      {
        $group: {
          _id: '$indicatorName',
          totalCount: { $sum: '$count' },
        },
      },
      { $sort: { totalCount: -1 } }, // highest to lowest
    ]);
  }

  async getIndicatorStatsRange(range: string) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (range) {
      case '7days':
        startDate = new Date();
        startDate.setDate(now.getDate() - 6);
        break;

      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;

      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;

      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;

      case 'last2Years':
        startDate = new Date(now.getFullYear() - 2, 0, 1);
        break;

      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;

      default:
        throw new Error(
          'Invalid range. Allowed values: 7days, thisMonth, lastMonth, thisYear, last2Years, last6Months',
        );
    }

    return this.indicatorModel.aggregate([
      {
        $match: {
          date: {
            $gte: startDate.toISOString().slice(0, 10),
            $lte: endDate.toISOString().slice(0, 10),
          },
        },
      },
      {
        $group: {
          _id: '$indicatorName',
          totalCount: { $sum: '$count' },
        },
      },
      { $sort: { totalCount: -1 } },
    ]);
  }

}
