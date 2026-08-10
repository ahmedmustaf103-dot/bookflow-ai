-- Sprint 8: Postgres RLS defense-in-depth for tenant tables.
-- Policies allow all when app.organization_id is unset (migrations, cron, admin).
-- When set via set_config(..., true), rows are scoped to that organization.

CREATE OR REPLACE FUNCTION bookflow_current_org_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships',
    'locations',
    'resources',
    'services',
    'clients',
    'bookings',
    'subscriptions',
    'notification_outbox',
    'audit_logs',
    'ai_runs',
    'google_calendar_connections'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS bookflow_tenant_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS bookflow_tenant_write ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS bookflow_tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY bookflow_tenant_isolation ON %I FOR ALL USING (
         bookflow_current_org_id() IS NULL
         OR "organizationId" = bookflow_current_org_id()
       ) WITH CHECK (
         bookflow_current_org_id() IS NULL
         OR "organizationId" = bookflow_current_org_id()
       )',
      t
    );
  END LOOP;
END $$;
