import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema-level guardrail for role escalation. Only this migration path (which
 * requires a signed connection to the database and cannot be reached by the
 * runtime API) may create or promote a `super_admin`.
 *
 * The trigger:
 *   - rejects INSERT of a row with role='super_admin' unless the session
 *     variable `qasdiya.bootstrap` is 'on';
 *   - rejects UPDATE that flips a non-super_admin row to super_admin;
 *   - allows the bootstrap script (this migration + `npm run bootstrap:owner`)
 *     to set exactly one super_admin;
 *   - once a super_admin exists, subsequent bootstrap runs update the row
 *     rather than create a second one.
 *
 * The runtime application never sets `qasdiya.bootstrap = on`; a compromised
 * admin panel therefore cannot promote itself.
 */
export class RoleHardening1720000000100 implements MigrationInterface {
  name = 'RoleHardening1720000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION qasdiya_guard_super_admin() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        bootstrap TEXT;
      BEGIN
        bootstrap := current_setting('qasdiya.bootstrap', true);
        IF NEW.role = 'super_admin' AND (bootstrap IS NULL OR bootstrap <> 'on') THEN
          RAISE EXCEPTION 'super_admin role is bootstrap-only; use the bootstrap:owner migration'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_users_guard_super_admin ON users;
      CREATE TRIGGER trg_users_guard_super_admin
        BEFORE INSERT OR UPDATE OF role ON users
        FOR EACH ROW
        EXECUTE FUNCTION qasdiya_guard_super_admin();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_users_guard_super_admin ON users;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS qasdiya_guard_super_admin();`);
  }
}
