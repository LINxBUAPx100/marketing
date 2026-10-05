CREATE TABLE "cotizacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"subtotal" integer NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"iva" integer NOT NULL,
	"total" integer NOT NULL,
	"vigencia_hasta" timestamp with time zone NOT NULL,
	"estado" text DEFAULT 'abierta' NOT NULL,
	"motivo_rechazo" text,
	"venta_id" uuid,
	"notas" text,
	"condiciones" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_partida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"precio_unitario" integer NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"importe" integer NOT NULL,
	"notas" text,
	"orden" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etapa_produccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text DEFAULT 'proceso' NOT NULL,
	"responsable_id" uuid,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text,
	"enlace" text,
	"leida" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_id" uuid NOT NULL,
	"etapa_id" uuid NOT NULL,
	"responsable_id" uuid,
	"usuario_id" uuid NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_produccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	"etapa_id" uuid NOT NULL,
	"responsable_id" uuid,
	"fecha_compromiso" timestamp with time zone,
	"estado" text DEFAULT 'activa' NOT NULL,
	"notas" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" uuid,
	"entregada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seguimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"nota" text NOT NULL,
	"hecho_en" timestamp with time zone,
	"resultado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "producto" ADD COLUMN "requiere_produccion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_partida" ADD CONSTRAINT "cotizacion_partida_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_partida" ADD CONSTRAINT "cotizacion_partida_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_produccion" ADD CONSTRAINT "etapa_produccion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_produccion" ADD CONSTRAINT "etapa_produccion_responsable_id_usuario_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_evento" ADD CONSTRAINT "orden_evento_orden_id_orden_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."orden_produccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_evento" ADD CONSTRAINT "orden_evento_etapa_id_etapa_produccion_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapa_produccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_evento" ADD CONSTRAINT "orden_evento_responsable_id_usuario_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_evento" ADD CONSTRAINT "orden_evento_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_etapa_id_etapa_produccion_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapa_produccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_responsable_id_usuario_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_produccion" ADD CONSTRAINT "orden_produccion_actualizado_por_usuario_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cotizacion_sucursal_id_folio_index" ON "cotizacion" USING btree ("sucursal_id","folio");--> statement-breakpoint
CREATE INDEX "cotizacion_negocio_id_creado_en_index" ON "cotizacion" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "notificacion_usuario_id_leida_index" ON "notificacion" USING btree ("usuario_id","leida");--> statement-breakpoint
CREATE INDEX "orden_evento_orden_id_creado_en_index" ON "orden_evento" USING btree ("orden_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "orden_produccion_venta_id_index" ON "orden_produccion" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "orden_produccion_negocio_id_estado_index" ON "orden_produccion" USING btree ("negocio_id","estado");--> statement-breakpoint
CREATE INDEX "seguimiento_usuario_id_hecho_en_index" ON "seguimiento" USING btree ("usuario_id","hecho_en");