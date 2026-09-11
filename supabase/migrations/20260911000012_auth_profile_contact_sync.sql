BEGIN;
-- Auth owns login identifiers. Keep display/contact data synchronized in the same transaction.
CREATE FUNCTION public.sync_auth_contact() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email,
    phone = CASE WHEN nullif(NEW.phone, '') IS NULL THEN NULL ELSE '+' || ltrim(NEW.phone, '+') END,
    full_name = coalesce(NEW.raw_user_meta_data->>'full_name', full_name),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_contact_updated AFTER UPDATE OF email, phone, raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_contact();
REVOKE ALL ON FUNCTION public.sync_auth_contact() FROM PUBLIC;
-- Do not turn legacy contact numbers into login credentials without an admin checking them.
COMMIT;
