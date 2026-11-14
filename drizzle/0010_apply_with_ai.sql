ALTER TABLE "jobs" ADD COLUMN "apply_with_ai" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Everyone gets a "Ready to apply" stage, just before "Applied" (or last if there is no Applied).
-- Users who already have one are left alone. Shift first, then insert into the gap.
UPDATE "statuses" s
SET "position" = s."position" + 1
WHERE NOT EXISTS (
    SELECT 1 FROM "statuses" r
    WHERE r."user_id" = s."user_id" AND lower(r."name") = 'ready to apply'
  )
  AND s."position" >= (
    SELECT a."position" FROM "statuses" a
    WHERE a."user_id" = s."user_id" AND lower(a."name") = 'applied'
    ORDER BY a."position" LIMIT 1
  );
--> statement-breakpoint
INSERT INTO "statuses" ("id", "user_id", "name", "color", "kind", "position")
SELECT
  gen_random_uuid()::text,
  u."id",
  'Ready to apply',
  'blue',
  'open',
  COALESCE(
    (SELECT a."position" - 1 FROM "statuses" a
     WHERE a."user_id" = u."id" AND lower(a."name") = 'applied'
     ORDER BY a."position" LIMIT 1),
    (SELECT COALESCE(MAX(m."position"), -1) + 1 FROM "statuses" m WHERE m."user_id" = u."id")
  )
FROM "user" u
WHERE EXISTS (SELECT 1 FROM "statuses" x WHERE x."user_id" = u."id")
  AND NOT EXISTS (
    SELECT 1 FROM "statuses" r
    WHERE r."user_id" = u."id" AND lower(r."name") = 'ready to apply'
  );
