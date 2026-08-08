CREATE TABLE "board_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"term_end_at" date NOT NULL,
	"stage" text DEFAULT 'due' NOT NULL,
	"election_date" date,
	"delegate_name" text,
	"notes" text,
	"stage_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_renewals_stage_check" CHECK ("board_renewals"."stage" in ('due','notified','scheduled','delegateAssigned','elected','minutesReceived','boardUpdated'))
);
--> statement-breakpoint
ALTER TABLE "board_renewals" ADD CONSTRAINT "board_renewals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_renewals_organization_term_key" ON "board_renewals" USING btree ("organization_id","term_end_at");--> statement-breakpoint
CREATE INDEX "board_renewals_stage_idx" ON "board_renewals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "board_renewals_election_date_idx" ON "board_renewals" USING btree ("election_date");--> statement-breakpoint
CREATE INDEX "board_renewals_closed_at_idx" ON "board_renewals" USING btree ("closed_at");