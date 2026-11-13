CREATE TABLE "job_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"platform" text NOT NULL,
	"outcome" text NOT NULL,
	"url" text,
	"resume_id" text,
	"resume_title" text,
	"submitted" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_applications_user_idx" ON "job_applications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "job_applications_job_idx" ON "job_applications" USING btree ("job_id");