CREATE TYPE "public"."profile_question_status" AS ENUM('pending', 'answered', 'na', 'unsure');--> statement-breakpoint
CREATE TABLE "profile_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question" text NOT NULL,
	"about" text,
	"status" "profile_question_status" DEFAULT 'pending' NOT NULL,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_questions" ADD CONSTRAINT "profile_questions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_questions_user_idx" ON "profile_questions" USING btree ("user_id","status","created_at");