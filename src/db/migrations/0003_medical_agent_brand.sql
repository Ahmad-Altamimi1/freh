ALTER TABLE "organizations" ADD COLUMN "term_start" date;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "term_end" date;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "term_length" integer;--> statement-breakpoint
CREATE INDEX "organizations_term_start_idx" ON "organizations" USING btree ("term_start");--> statement-breakpoint
CREATE INDEX "organizations_term_end_idx" ON "organizations" USING btree ("term_end");