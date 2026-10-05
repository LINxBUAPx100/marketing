CREATE TABLE "consumible" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maquina_id" uuid NOT NULL,
	"contador_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"rendimiento" integer NOT NULL,
	"costo" integer,
	"insumo_id" uuid,
	"lectura_instalacion" numeric(12, 3) NOT NULL,
	"instalado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"lectura_retiro" numeric(12, 3),
	"retirado_en" timestamp with time zone,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maquina_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lectura_contador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contador_id" uuid NOT NULL,
	"valor" numeric(12, 3) NOT NULL,
	"momento" text DEFAULT 'otra' NOT NULL,
	"nota" text,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maquina" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"marca" text,
	"modelo" text,
	"serie" text,
	"notas" text,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"maquina_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"motivo" text NOT NULL,
	"responsable_id" uuid,
	"venta_id" uuid,
	"nota" text,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "producto" ADD COLUMN "tipo_impresion" text;--> statement-breakpoint
ALTER TABLE "producto" ADD COLUMN "impresiones_por_unidad" numeric(12, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "consumible" ADD CONSTRAINT "consumible_maquina_id_maquina_id_fk" FOREIGN KEY ("maquina_id") REFERENCES "public"."maquina"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumible" ADD CONSTRAINT "consumible_contador_id_contador_id_fk" FOREIGN KEY ("contador_id") REFERENCES "public"."contador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumible" ADD CONSTRAINT "consumible_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumible" ADD CONSTRAINT "consumible_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contador" ADD CONSTRAINT "contador_maquina_id_maquina_id_fk" FOREIGN KEY ("maquina_id") REFERENCES "public"."maquina"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lectura_contador" ADD CONSTRAINT "lectura_contador_contador_id_contador_id_fk" FOREIGN KEY ("contador_id") REFERENCES "public"."contador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lectura_contador" ADD CONSTRAINT "lectura_contador_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maquina" ADD CONSTRAINT "maquina_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maquina" ADD CONSTRAINT "maquina_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma" ADD CONSTRAINT "merma_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma" ADD CONSTRAINT "merma_maquina_id_maquina_id_fk" FOREIGN KEY ("maquina_id") REFERENCES "public"."maquina"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma" ADD CONSTRAINT "merma_responsable_id_usuario_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma" ADD CONSTRAINT "merma_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma" ADD CONSTRAINT "merma_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lectura_contador_contador_id_creado_en_index" ON "lectura_contador" USING btree ("contador_id","creado_en");--> statement-breakpoint
CREATE INDEX "merma_negocio_id_creado_en_index" ON "merma" USING btree ("negocio_id","creado_en");