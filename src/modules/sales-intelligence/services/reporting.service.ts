import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerSession } from '@/database';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(CustomerSession)
    private readonly sessionRepository: Repository<CustomerSession>,
  ) {}

  async conversionReport(storeId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : new Date();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 (e.g. 2026-04-01)');
    }
    const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 366) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    // Single aggregate query for the funnel
    const [funnelRow]: Array<{
      total: string;
      withRecommendations: string;
      converted: string;
    }> = await this.sessionRepository.manager.query(
      `SELECT
         COUNT(DISTINCT s.id)::int                                             AS "total",
         COUNT(DISTINCT s.id) FILTER (WHERE r.id IS NOT NULL)::int             AS "withRecommendations",
         COUNT(DISTINCT s.id) FILTER (WHERE s."sessionStatus" = 'CONVERTED')::int AS "converted"
       FROM customer_sessions s
       LEFT JOIN outfit_recommendations r ON r."customerSessionId" = s.id
       WHERE s."storeId" = $1
         AND s."createdAt" >= $2
         AND s."createdAt" <= $3`,
      [storeId, fromDate, toDate],
    );

    // Per-rank breakdown
    const rankRows: Array<{
      rank: string;
      presented: string;
      converted: string;
    }> = await this.sessionRepository.manager.query(
      `SELECT
         r.rank::int,
         COUNT(*) FILTER (WHERE r."wasPresented" = true)::int AS "presented",
         COUNT(*) FILTER (WHERE r."convertedAt" IS NOT NULL)::int AS "converted"
       FROM outfit_recommendations r
       JOIN customer_sessions s ON s.id = r."customerSessionId"
       WHERE s."storeId" = $1
         AND s."createdAt" >= $2
         AND s."createdAt" <= $3
       GROUP BY r.rank
       ORDER BY r.rank`,
      [storeId, fromDate, toDate],
    );

    const total = parseInt(funnelRow.total, 10);
    const withRecommendations = parseInt(funnelRow.withRecommendations, 10);
    const converted = parseInt(funnelRow.converted, 10);

    return {
      period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      sessions: {
        total,
        withRecommendations,
        converted,
        conversionRate: withRecommendations > 0
          ? Math.round((converted / withRecommendations) * 1000) / 1000
          : 0,
      },
      recommendationRankBreakdown: rankRows.map((r) => ({
        rank: parseInt(r.rank, 10),
        presented: parseInt(r.presented, 10),
        converted: parseInt(r.converted, 10),
      })),
    };
  }
}
