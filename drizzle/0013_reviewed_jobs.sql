CREATE TABLE "reviewed_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"source" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"decision" text NOT NULL,
	"score" integer,
	"reason" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviewed_jobs" ADD CONSTRAINT "reviewed_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviewed_jobs_user_key_idx" ON "reviewed_jobs" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "reviewed_jobs_user_time_idx" ON "reviewed_jobs" USING btree ("user_id","reviewed_at");