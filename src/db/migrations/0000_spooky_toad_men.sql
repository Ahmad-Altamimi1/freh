CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"national_id" text,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"district" text NOT NULL,
	"classification" text,
	"established_at" date,
	"director_name" text,
	"mobile" text,
	"serial_no" integer,
	"search_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "organizations_district_idx" ON "organizations" USING btree ("district");--> statement-breakpoint
CREATE INDEX "organizations_classification_idx" ON "organizations" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "organizations_established_at_idx" ON "organizations" USING btree ("established_at");--> statement-breakpoint
CREATE INDEX "organizations_national_id_idx" ON "organizations" USING btree ("national_id");