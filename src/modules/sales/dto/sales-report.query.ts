import { IsOptional, IsISO8601 } from 'class-validator';

export class SalesReportQueryDto {
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @IsISO8601()
  @IsOptional()
  endDate?: string;
}
