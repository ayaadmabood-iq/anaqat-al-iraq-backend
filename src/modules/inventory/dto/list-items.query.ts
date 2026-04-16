import { IsOptional, IsUUID, IsBoolean, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Query DTO for GET /inventory/items. The global ValidationPipe runs with
 * `transform: true`, so we need explicit rules here — without them, isActive
 * arrives as the literal string "false" which is truthy. Transform turns
 * "true"/"false" into proper booleans before class-validator inspects them.
 */
export class ListItemsQueryDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  colorFamily?: string;
}
