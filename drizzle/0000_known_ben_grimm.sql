CREATE TYPE "public"."kwt_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('ketua', 'bendahara', 'anggota');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('harvest', 'price_change', 'new_order', 'order_created', 'order_paid', 'stock_out', 'order_expired', 'broadcast', 'test', 'password_reset', 'kwt_review');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'processing', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."pricing_event_type" AS ENUM('recompute', 'manual');--> statement-breakpoint
CREATE TYPE "public"."quality_grade" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."waste_destination" AS ENUM('donasi', 'kompos', 'hilang');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid NOT NULL,
	"user_id" text,
	"rating" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvest_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"quality" text DEFAULT 'A' NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"waste_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"waste_destination" "waste_destination" DEFAULT 'hilang' NOT NULL,
	"harvested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quality" "quality_grade" DEFAULT 'A' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kwt_commission_settings" (
	"kwt_id" uuid PRIMARY KEY NOT NULL,
	"rate_percent" integer DEFAULT 2 NOT NULL,
	"handling_fee" integer DEFAULT 500 NOT NULL,
	"min_order_value" integer DEFAULT 10000 NOT NULL,
	"discount_threshold" integer DEFAULT 1000000 NOT NULL,
	"discount_percent" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kwt_members" (
	"kwt_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'anggota' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kwt_members_kwt_id_user_id_pk" PRIMARY KEY("kwt_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "kwt_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"settled_through" timestamp with time zone NOT NULL,
	"fee_count" integer DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'transfer' NOT NULL,
	"reference" text,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kwts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"regency" text,
	"province" text,
	"region_code" text,
	"weather_adm4" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_holder" text,
	"qris_image_url" text,
	"payment_note" text,
	"status" "kwt_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"invite_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid,
	"user_id" text,
	"kind" "notification_kind" NOT NULL,
	"target" text NOT NULL,
	"message" text NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"error" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" integer NOT NULL,
	"wholesale_percent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"note" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"midtrans_order_id" text,
	"payment_settled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kwt_id" uuid NOT NULL,
	"order_total" integer NOT NULL,
	"rate_percent" integer NOT NULL,
	"commission_fee" integer NOT NULL,
	"handling_fee" integer NOT NULL,
	"total_fee" integer NOT NULL,
	"net_to_kwt" integer NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_reason" text,
	"reversed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "pricing_event_type" DEFAULT 'recompute' NOT NULL,
	"old_price" integer NOT NULL,
	"new_price" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"wholesale_tiers" text,
	"low_stock_threshold" numeric(12, 2) DEFAULT '10' NOT NULL,
	"high_stock_threshold" numeric(12, 2) DEFAULT '100' NOT NULL,
	"low_stock_percent" integer DEFAULT 10 NOT NULL,
	"high_stock_percent" integer DEFAULT -10 NOT NULL,
	"surge_window_hours" integer DEFAULT 24 NOT NULL,
	"surge_min_orders" integer DEFAULT 5 NOT NULL,
	"surge_percent" integer DEFAULT 5 NOT NULL,
	"min_price_percent" integer DEFAULT 70 NOT NULL,
	"max_price_percent" integer DEFAULT 150 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kwt_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'sayur' NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"description" text,
	"photo_url" text,
	"base_price" integer NOT NULL,
	"current_price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"level" text NOT NULL,
	"name" text NOT NULL,
	"parent_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"phone" text,
	"wa_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_schedules" ADD CONSTRAINT "harvest_schedules_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_schedules" ADD CONSTRAINT "harvest_schedules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_schedules" ADD CONSTRAINT "harvest_schedules_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kwt_commission_settings" ADD CONSTRAINT "kwt_commission_settings_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kwt_members" ADD CONSTRAINT "kwt_members_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kwt_members" ADD CONSTRAINT "kwt_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kwt_settlements" ADD CONSTRAINT "kwt_settlements_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kwt_settlements" ADD CONSTRAINT "kwt_settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_events" ADD CONSTRAINT "pricing_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_kwt_id_kwts_id_fk" FOREIGN KEY ("kwt_id") REFERENCES "public"."kwts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "harvest_schedule_day_key" ON "harvest_schedules" USING btree ("product_id","day_of_week");--> statement-breakpoint
CREATE INDEX "harvests_product_time_idx" ON "harvests" USING btree ("product_id","harvested_at");--> statement-breakpoint
CREATE INDEX "harvests_member_idx" ON "harvests" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "kwt_members_user_idx" ON "kwt_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kwt_settlements_kwt_time_idx" ON "kwt_settlements" USING btree ("kwt_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kwts_slug_key" ON "kwts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_kwt_time_idx" ON "notifications" USING btree ("kwt_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_time_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_key" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_midtrans_key" ON "orders" USING btree ("midtrans_order_id");--> statement-breakpoint
CREATE INDEX "orders_kwt_status_idx" ON "orders" USING btree ("kwt_id","status");--> statement-breakpoint
CREATE INDEX "orders_expires_idx" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_fees_order_key" ON "platform_fees" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "platform_fees_kwt_time_idx" ON "platform_fees" USING btree ("kwt_id","created_at");--> statement-breakpoint
CREATE INDEX "pricing_events_product_time_idx" ON "pricing_events" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_rules_product_key" ON "pricing_rules" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_kwt_idx" ON "products" USING btree ("kwt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_kwt_slug_key" ON "products" USING btree ("kwt_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_level_key" ON "regions" USING btree ("code","level");