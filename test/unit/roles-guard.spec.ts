import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { ANY_ADMIN, FINANCE_ADMIN, OWNER_ONLY } from '@/modules/auth/roles';

function ctx(user: { role: string } | null): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();

  it('passes when no roles are set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce([]);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx({ role: 'customer' }))).toBe(true);
  });

  it('rejects unauthenticated users when a role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(ANY_ADMIN);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });

  it('rejects customers from admin routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(ANY_ADMIN);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx({ role: 'customer' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects support from finance-only routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(FINANCE_ADMIN);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx({ role: 'support' }))).toThrow(
      ForbiddenException,
    );
  });

  it('accepts super_admin everywhere', () => {
    const guard = new RolesGuard(reflector);
    for (const set of [ANY_ADMIN, FINANCE_ADMIN, OWNER_ONLY]) {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(set);
      expect(guard.canActivate(ctx({ role: 'super_admin' }))).toBe(true);
    }
  });

  it('legacy `admin` alias behaves like super_admin', () => {
    const guard = new RolesGuard(reflector);
    for (const set of [ANY_ADMIN, FINANCE_ADMIN, OWNER_ONLY]) {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(set);
      expect(guard.canActivate(ctx({ role: 'admin' }))).toBe(true);
    }
  });
});
