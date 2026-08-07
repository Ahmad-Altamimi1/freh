CREATE TABLE "correspondences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"type" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correspondences_type_check" CHECK ("correspondences"."type" in ('قادمة', 'واردة'))
);
--> statement-breakpoint
ALTER TABLE "correspondences" ADD CONSTRAINT "correspondences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "correspondences_organization_id_idx" ON "correspondences" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "correspondences_type_idx" ON "correspondences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "correspondences_created_at_idx" ON "correspondences" USING btree ("created_at");