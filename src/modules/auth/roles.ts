import type { UserRole } from '@/database';

/**
 * Role groupings per IRPB file 3 §7 (RBAC) mapped onto concrete route sets.
 * Add new roles here — do not scatter the enum across controllers.
 */
export const ANY_ADMIN: UserRole[] = [
  'super_admin',
  'admin',
  'content_manager',
  'finance_manager',
  'support',
];

export const CONTENT_ADMIN: UserRole[] = [
  'super_admin',
  'admin',
  'content_manager',
];

export const FINANCE_ADMIN: UserRole[] = [
  'super_admin',
  'admin',
  'finance_manager',
];

export const CUSTOMER_SUPPORT_ADMIN: UserRole[] = [
  'super_admin',
  'admin',
  'support',
];

/** Full ownership rights — only super_admin (and the legacy `admin` alias). */
export const OWNER_ONLY: UserRole[] = ['super_admin', 'admin'];

export const CUSTOMER_ROLES: UserRole[] = ['customer', 'user'];

/** True when the resolved user has any admin-tier role. */
export function isAdminRole(role: UserRole): boolean {
  return ANY_ADMIN.includes(role);
}
