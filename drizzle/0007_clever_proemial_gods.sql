CREATE TABLE "mensaje_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"cliente_id" uuid,
	"telefono" text NOT NULL,
	"plantilla" text NOT NULL,
	"variables" jsonb NOT NULL,
	"texto" text NOT NULL,
	"estado" text NOT NULL,
	"error" text,
	"wamid" text,
	"entidad" text,
	"entidad_id" uuid,
	"automatico" boolean DEFAULT false NOT NULL,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "negocio" ADD COLUMN "avisos_whatsapp" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "venta" ADD COLUMN "clave_local" uuid;--> statement-breakpoint
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "mensaje_whatsapp_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "mensaje_whatsapp_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "mensaje_whatsapp_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensaje_whatsapp_negocio_id_creado_en_index" ON "mensaje_whatsapp" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "mensaje_whatsapp_entidad_entidad_id_index" ON "mensaje_whatsapp" USING btree ("entidad","entidad_id");--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_claveLocal_unique" UNIQUE("clave_local");