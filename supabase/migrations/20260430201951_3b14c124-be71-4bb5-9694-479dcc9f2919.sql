CREATE TABLE public.shop_items (
  item_key text PRIMARY KEY,
  item_name text NOT NULL,
  kind purchase_kind NOT NULL,
  currency purchase_currency NOT NULL,
  cost integer NOT NULL CHECK (cost > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active shop items"
  ON public.shop_items FOR SELECT
  TO authenticated
  USING (active = true);

INSERT INTO public.shop_items (item_key, item_name, kind, currency, cost) VALUES
  ('hat_wizard',    'Wizard Hat',     'cosmetic',  'star',  10),
  ('glasses',       'Cool Shades',    'cosmetic',  'star',  15),
  ('crown_silver',  'Silver Crown',   'cosmetic',  'star',  25),
  ('halo',          'Halo',           'cosmetic',  'star',  40),
  ('robot',         'Robot Face',     'cosmetic',  'star',  60),
  ('rainbow_aura',  'Rainbow Aura',   'cosmetic',  'star', 100),
  ('homework_pass', 'Homework Pass',  'privilege', 'crown', 50),
  ('seat_swap',     'Seat Swap',      'privilege', 'crown', 30);

CREATE OR REPLACE FUNCTION public.enforce_shop_purchase_canonical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item public.shop_items%ROWTYPE;
BEGIN
  SELECT * INTO _item FROM public.shop_items WHERE item_key = NEW.item_key AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive shop item: %', NEW.item_key;
  END IF;

  NEW.item_name := _item.item_name;
  NEW.kind      := _item.kind;
  NEW.currency  := _item.currency;
  NEW.cost      := _item.cost;

  IF _item.kind = 'privilege' THEN
    NEW.status := 'pending';
    IF NEW.class_id IS NULL THEN
      RAISE EXCEPTION 'Privilege purchases require a class_id';
    END IF;
  ELSE
    NEW.status := 'approved';
    NEW.class_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_purchase_canonical ON public.shop_purchases;
CREATE TRIGGER shop_purchase_canonical
  BEFORE INSERT ON public.shop_purchases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_purchase_canonical();

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_link_url_http_only
  CHECK (link_url IS NULL OR link_url ~* '^https?://');

DROP POLICY IF EXISTS "Students manage own status" ON public.assignment_status_records;

CREATE POLICY "Students view own status"
  ON public.assignment_status_records FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students insert status for joined-class assignments"
  ON public.assignment_status_records FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
  );

CREATE POLICY "Students update status for joined-class assignments"
  ON public.assignment_status_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND public.is_class_member(a.class_id, auth.uid())
    )
  );

CREATE POLICY "Students delete own status"
  ON public.assignment_status_records FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user_role()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_message(uuid, uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_join_code()            FROM PUBLIC, anon, authenticated;