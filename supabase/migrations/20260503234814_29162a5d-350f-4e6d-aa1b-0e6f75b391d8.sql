-- Ensure the canonical shop item trigger fires BEFORE the balance-deduction trigger.
-- PostgreSQL fires BEFORE triggers in alphabetical order, so rename the canonical
-- enforcement trigger so it runs first and overwrites client-supplied cost/currency/status.
DROP TRIGGER IF EXISTS shop_purchase_canonical ON public.shop_purchases;
DROP TRIGGER IF EXISTS on_shop_purchase_created ON public.shop_purchases;

CREATE TRIGGER a_shop_purchase_canonical
  BEFORE INSERT ON public.shop_purchases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_purchase_canonical();

CREATE TRIGGER b_shop_purchase_balance
  BEFORE INSERT ON public.shop_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_shop_purchase();