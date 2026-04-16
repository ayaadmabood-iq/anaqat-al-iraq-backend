import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConvertRecommendationDto {
  @ApiProperty({ description: 'UUID of the completed sale to link to this recommendation' })
  @IsUUID()
  saleId: string;
}
