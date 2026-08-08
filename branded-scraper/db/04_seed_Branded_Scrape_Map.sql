-- Gated: APPROVE DB. Idempotent upsert.
-- Source: nigerianprice.com research, 2026-08-08. 17 rows for ITM01044-ITM01060 (CAT010, all Unit='carton').
-- 6 items have a confirmed full-carton article match (active=1); 11 have no exact carton-level
-- match on nigerianprice.com and are seeded inactive with a note explaining why (see notes col).
MERGE dbo.Branded_Scrape_Map AS t
USING (VALUES
 ('ITM01044','NGPRICE','https://nigerianprice.com/titus-sardine-carton-prices-in-nigeria/',50,1.0,'1 Carton',1,'50 x 125g'),
 ('ITM01045','NGPRICE','',NULL,1.0,NULL,0,'no carton article for canned Geisha mackerel (site only has frozen mackerel fish)'),
 ('ITM01046','NGPRICE','',NULL,1.0,NULL,0,'no carton article found for Exeter Corned Beef'),
 ('ITM01047','NGPRICE','https://nigerianprice.com/tomato-paste-carton-prices-in-nigeria/',50,1.0,'Peppe & Onion Tomato Paste',1,'Gino 70g x50 sachet (Peppe & Onion variant); matches 50x70g spec'),
 ('ITM01048','NGPRICE','',NULL,1.0,NULL,0,'Gino 210g tin carton on site is x24 not x48; no exact match'),
 ('ITM01049','NGPRICE','https://nigerianprice.com/tomato-paste-carton-prices-in-nigeria/',20,1.0,'Tasty Tom Tomato Paste Sachets',1,'20 x 70g sachets'),
 ('ITM01050','NGPRICE','',NULL,1.0,NULL,0,'De Rica only listed as 70g sachet; no 400g tin carton line'),
 ('ITM01051','NGPRICE','https://nigerianprice.com/golden-penny-spaghetti-prices-in-nigeria/',20,1.0,'Twist Macaroni 500g X20',1,'20 x 500g'),
 ('ITM01052','NGPRICE','https://nigerianprice.com/spaghetti-carton-prices-in-nigeria/',20,1.0,'Honeywell Spaghetti 500G',1,'20 x 500g'),
 ('ITM01053','NGPRICE','',NULL,1.0,NULL,0,'no carton article found for Honeywell Noodles'),
 ('ITM01054','NGPRICE','https://nigerianprice.com/golden-penny-noodles-prices-in-nigeria/',40,1.0,'Carton Of 40',1,'40 x 70g'),
 ('ITM01055','NGPRICE','',NULL,1.0,NULL,0,'Minimie mentioned in brand listicle only; no carton pricing'),
 ('ITM01056','NGPRICE','',NULL,1.0,NULL,0,'site carton is 800g x6, not 900g x6 per spec; no exact match'),
 ('ITM01057','NGPRICE','',NULL,1.0,NULL,0,'no 12-count carton line for Nasco Cornflakes; only single units/sachets'),
 ('ITM01058','NGPRICE','',NULL,1.0,NULL,0,'no Checkers Custard carton pricing found (brand-mention listicle only)'),
 ('ITM01059','NGPRICE','',NULL,1.0,NULL,0,'only single-tin retail price found (415g), no carton(12) pricing'),
 ('ITM01060','NGPRICE','',NULL,1.0,NULL,0,'no carton article found for Peeled Tomatoes')
) AS s(item_id,source,fetch_url,pack_count,unit_multiplier,parse_hint,active,notes)
   ON t.item_id=s.item_id AND t.source=s.source
WHEN MATCHED THEN UPDATE SET t.fetch_url=s.fetch_url, t.pack_count=s.pack_count,
     t.unit_multiplier=s.unit_multiplier, t.parse_hint=s.parse_hint, t.active=s.active, t.notes=s.notes
WHEN NOT MATCHED THEN INSERT (item_id,source,fetch_url,pack_count,unit_multiplier,parse_hint,active,notes)
     VALUES (s.item_id,s.source,s.fetch_url,s.pack_count,s.unit_multiplier,s.parse_hint,s.active,s.notes);
