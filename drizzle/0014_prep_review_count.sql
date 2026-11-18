ALTER TABLE "prep_progress" ALTER COLUMN "state" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_progress" ADD COLUMN "reviews" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "prep_progress" SET "reviews" = 1 WHERE "state" IN ('done', 'confident');
