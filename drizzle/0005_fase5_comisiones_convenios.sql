CREATE TABLE "comision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"base" integer NOT NULL,
	"bp" integer NOT NULL,
	"monto" integer NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"pago_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convenio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"descuento_bp" integer DEFAULT 0 NOT NULL,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"limite_credito" integer,
	"vigente_hasta" timestamp with time zone,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convenio_precio" (
	"convenio_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"precio" integer NOT NULL,
	CONSTRAINT "convenio_precio_convenio_id_producto_id_pk" PRIMARY KEY("convenio_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE "pago_comision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"movimiento_caja_id" uuid,
	"notas" text,
	"registrado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precio_volumen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"desde" numeric(12, 3) NOT NULL,
	"precio" integer NOT NULL,
	"precio_revendedor" integer
);
--> statement-breakpoint
ALTER TABLE "categoria" ADD COLUMN "comision_bp" integer;--> statement-breakpoint
ALTER TABLE "comision" ADD CONSTRAINT "comision_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comision" ADD CONSTRAINT "comision_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comision" ADD CONSTRAINT "comision_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comision" ADD CONSTRAINT "comision_pago_id_pago_comision_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pago_comision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_precio" ADD CONSTRAINT "convenio_precio_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_precio" ADD CONSTRAINT "convenio_precio_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_comision" ADD CONSTRAINT "pago_comision_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_comision" ADD CONSTRAINT "pago_comision_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_comision" ADD CONSTRAINT "pago_comision_movimiento_caja_id_movimiento_caja_id_fk" FOREIGN KEY ("movimiento_caja_id") REFERENCES "public"."movimiento_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_comision" ADD CONSTRAINT "pago_comision_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_volumen" ADD CONSTRAINT "precio_volumen_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comision_usuario_id_estado_index" ON "comision" USING btree ("usuario_id","estado");--> statement-breakpoint
CREATE INDEX "comision_venta_id_index" ON "comision" USING btree ("venta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "convenio_cliente_id_index" ON "convenio" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "precio_volumen_producto_id_desde_index" ON "precio_volumen" USING btree ("producto_id","desde");