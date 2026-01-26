CREATE TABLE "custom_llm_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"encrypted_api_key" text,
	"encrypted_headers" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_llm_endpoints" ADD CONSTRAINT "custom_llm_endpoints_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_llm_endpoints" ADD CONSTRAINT "custom_llm_endpoints_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_llm_endpoint_workspace_name" ON "custom_llm_endpoints" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "custom_llm_endpoint_workspace_idx" ON "custom_llm_endpoints" USING btree ("workspace_id");