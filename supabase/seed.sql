-- Local development only (runs on `supabase db reset`). Never run in production.
update public.app_config set dev_entitlements_enabled = true where id;
