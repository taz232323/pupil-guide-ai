INSERT INTO public.shop_items (item_key, item_name, description, emoji, kind, currency, cost, active)
VALUES ('aura_beams', 'Light Beams Aura', 'A rare cinematic aura of shimmering light beams that dance behind your avatar.', '✨', 'cosmetic', 'star', 800, true)
ON CONFLICT (item_key) DO UPDATE
  SET item_name = EXCLUDED.item_name,
      description = EXCLUDED.description,
      emoji = EXCLUDED.emoji,
      kind = EXCLUDED.kind,
      currency = EXCLUDED.currency,
      cost = EXCLUDED.cost,
      active = EXCLUDED.active;