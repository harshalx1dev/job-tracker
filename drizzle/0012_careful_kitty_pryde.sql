CREATE TABLE "search_runs" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"query_key" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_runs_user_id_source_query_key_pk" PRIMARY KEY("user_id","source","query_key")
);
--> statement-breakpoint
CREATE TABLE "seen_listings" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seen_listings_user_id_source_external_id_pk" PRIMARY KEY("user_id","source","external_id")
);
--> statement-breakpoint
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seen_listings" ADD CONSTRAINT "seen_listings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seen_listings_user_time_idx" ON "seen_listings" USING btree ("user_id","seen_at");