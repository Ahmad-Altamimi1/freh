CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"action_href" text,
	"action_label" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" in ('unread','read','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_dedupe_key" ON "notifications" USING btree ("recipient_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_status_idx" ON "notifications" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_at_idx" ON "notifications" USING btree ("recipient_id","created_at");