import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectOrderDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class ApproveOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
