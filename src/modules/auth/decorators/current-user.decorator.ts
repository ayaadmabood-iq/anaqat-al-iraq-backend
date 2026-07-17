import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@/database';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest().user,
);
