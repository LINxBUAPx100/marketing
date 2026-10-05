CREATE TABLE "categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"empresa" text,
	"telefono" text,
	"correo" text,
	"tipo_precio" text DEFAULT 'publico' NOT NULL,
	"rfc" text,
	"razon_social" text,
	"regimen_fiscal" text,
	"codigo_postal" text,
	"uso_cfdi" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corte_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"resumen" jsonb NOT NULL,
	"efectivo_esperado" integer NOT NULL,
	"efectivo_contado" integer NOT NULL,
	"fondo_siguiente" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "existencia" (
	"producto_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) DEFAULT 0 NOT NULL,
	CONSTRAINT "existencia_producto_id_sucursal_id_pk" PRIMARY KEY("producto_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "folio" (
	"sucursal_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "folio_sucursal_id_tipo_pk" PRIMARY KEY("sucursal_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "movimiento_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text NOT NULL,
	"concepto" text NOT NULL,
	"metodo" text DEFAULT 'efectivo' NOT NULL,
	"monto" integer NOT NULL,
	"venta_id" uuid,
	"usuario_id" uuid NOT NULL,
	"corte_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimiento_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"motivo" text NOT NULL,
	"venta_id" uuid,
	"usuario_id" uuid,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	"metodo" text NOT NULL,
	"monto" integer NOT NULL,
	"recibido" integer,
	"referencia" text,
	"usuario_id" uuid NOT NULL,
	"corte_id" uuid,
	"cancelado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"categoria_id" uuid,
	"codigo" text,
	"nombre" text NOT NULL,
	"descripcion" text,
	"tipo" text DEFAULT 'producto' NOT NULL,
	"unidad" text DEFAULT 'pieza' NOT NULL,
	"precio" integer NOT NULL,
	"precio_revendedor" integer,
	"costo" integer,
	"existencia_minima" numeric(12, 3) DEFAULT 0 NOT NULL,
	"imagen" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"cliente_id" uuid,
	"usuario_id" uuid NOT NULL,
	"subtotal" integer NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"iva" integer NOT NULL,
	"total" integer NOT NULL,
	"pagado" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"fecha_entrega" timestamp with time zone,
	"notas" text,
	"motivo_cancelacion" text,
	"cancelada_por" uuid,
	"cancelada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta_partida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
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
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corte_caja" ADD CONSTRAINT "corte_caja_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corte_caja" ADD CONSTRAINT "corte_caja_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corte_caja" ADD CONSTRAINT "corte_caja_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio" ADD CONSTRAINT "folio_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_corte_id_corte_caja_id_fk" FOREIGN KEY ("corte_id") REFERENCES "public"."corte_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_corte_id_corte_caja_id_fk" FOREIGN KEY ("corte_id") REFERENCES "public"."corte_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_cancelada_por_usuario_id_fk" FOREIGN KEY ("cancelada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_partida" ADD CONSTRAINT "venta_partida_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_partida" ADD CONSTRAINT "venta_partida_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cliente_negocio_id_nombre_index" ON "cliente" USING btree ("negocio_id","nombre");--> statement-breakpoint
CREATE INDEX "movimiento_caja_sucursal_id_corte_id_index" ON "movimiento_caja" USING btree ("sucursal_id","corte_id");--> statement-breakpoint
CREATE INDEX "pago_sucursal_id_corte_id_index" ON "pago" USING btree ("sucursal_id","corte_id");--> statement-breakpoint
CREATE INDEX "producto_negocio_id_nombre_index" ON "producto" USING btree ("negocio_id","nombre");--> statement-breakpoint
CREATE INDEX "venta_negocio_id_creado_en_index" ON "venta" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "venta_cliente_id_index" ON "venta" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venta_sucursal_id_folio_index" ON "venta" USING btree ("sucursal_id","folio");