INSERT INTO public.shop_items (item_key, item_name, description, emoji, kind, currency, cost, active)
VALUES ('aura_aurora', 'Aurora Aura', 'A radiant wave of celestial colors that flows endlessly around its owner.', '🌌', 'cosmetic', 'star', 500, true)
ON CONFLICT (item_key) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  kind = EXCLUDED.kind,
  currency = EXCLUDED.currency,
  cost = EXCLUDED.cost,
  active = true;