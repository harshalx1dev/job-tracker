CREATE TYPE "public"."prep_visibility" AS ENUM('private', 'link');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"word_limit" integer,
	"embedding" real[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"channel" text NOT NULL,
	"tone" text NOT NULL,
	"recipient_name" text,
	"subject" text,
	"body" text NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prep_plan_items" (
	"plan_id" text NOT NULL,
	"question_id" text NOT NULL,
	"day" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "prep_plan_items_plan_id_question_id_pk" PRIMARY KEY("plan_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "prep_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"kind" text NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"daily_budget_min" integer DEFAULT 240 NOT NULL,
	"visibility" "prep_visibility" DEFAULT 'private' NOT NULL,
	"share_token" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prep_plans_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "prep_progress" (
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"question_id" text NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prep_progress_user_id_plan_id_question_id_pk" PRIMARY KEY("user_id","plan_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "question_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"license" text,
	"question_count" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"topic" text NOT NULL,
	"subtopic" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"priority" text NOT NULL,
	"frequency" real DEFAULT 0.5 NOT NULL,
	"difficulty" text,
	"est_minutes" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"design" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_plan_items" ADD CONSTRAINT "prep_plan_items_plan_id_prep_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."prep_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_plan_items" ADD CONSTRAINT "prep_plan_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_plans" ADD CONSTRAINT "prep_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_plans" ADD CONSTRAINT "prep_plans_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_progress" ADD CONSTRAINT "prep_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_progress" ADD CONSTRAINT "prep_progress_plan_id_prep_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."prep_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_progress" ADD CONSTRAINT "prep_progress_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_id_question_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."question_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_user_idx" ON "answers" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "outreach_user_idx" ON "outreach_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "prep_plans_job_idx" ON "prep_plans" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prep_plans_job_kind_idx" ON "prep_plans" USING btree ("job_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_source_ext_idx" ON "questions" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "resumes_user_idx" ON "resumes" USING btree ("user_id","updated_at");