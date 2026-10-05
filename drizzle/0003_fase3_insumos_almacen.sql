CREATE TABLE "compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"referencia" text,
	"fecha" timestamp with time zone NOT NULL,
	"vencimiento" timestamp with time zone NOT NULL,
	"total" integer NOT NULL,
	"pagado" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"notas" text,
	"usuario_id" uuid NOT NULL,
	"motivo_cancelacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compra_partida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"insumo_id" uuid,
	"producto_id" uuid,
	"cantidad" numeric(12, 3) NOT NULL,
	"costo_unitario" numeric(14, 4) NOT NULL,
	"importe" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "existencia_insumo" (
	"insumo_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) DEFAULT 0 NOT NULL,
	CONSTRAINT "existencia_insumo_insumo_id_sucursal_id_pk" PRIMARY KEY("insumo_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"codigo" text,
	"unidad" text NOT NULL,
	"costo" numeric(14, 4) DEFAULT 0 NOT NULL,
	"existencia_minima" numeric(12, 3) DEFAULT 0 NOT NULL,
	"proveedor_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimiento_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"motivo" text NOT NULL,
	"venta_id" uuid,
	"compra_id" uuid,
	"traspaso_id" uuid,
	"usuario_id" uuid,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago_proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"compra_id" uuid NOT NULL,
	"metodo" text NOT NULL,
	"monto" integer NOT NULL,
	"referencia" text,
	"movimiento_caja_id" uuid,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"contacto" text,
	"telefono" text,
	"correo" text,
	"rfc" text,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receta" (
	"producto_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	CONSTRAINT "receta_producto_id_insumo_id_pk" PRIMARY KEY("producto_id","insumo_id")
);
--> statement-breakpoint
CREATE TABLE "traspaso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"origen_id" uuid NOT NULL,
	"destino_id" uuid NOT NULL,
	"notas" text,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traspaso_partida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"traspaso_id" uuid NOT NULL,
	"insumo_id" uuid,
	"producto_id" uuid,
	"cantidad" numeric(12, 3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD COLUMN "compra_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD COLUMN "traspaso_id" uuid;--> statement-breakpoint
ALTER TABLE "venta_partida" ADD COLUMN "costo" integer;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_proveedor_id_proveedor_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra" ADD CONSTRAINT "compra_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_partida" ADD CONSTRAINT "compra_partida_compra_id_compra_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_partida" ADD CONSTRAINT "compra_partida_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_partida" ADD CONSTRAINT "compra_partida_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "existencia_insumo" ADD CONSTRAINT "existencia_insumo_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "existencia_insumo" ADD CONSTRAINT "existencia_insumo_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_insumo" ADD CONSTRAINT "movimiento_insumo_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_insumo" ADD CONSTRAINT "movimiento_insumo_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_insumo" ADD CONSTRAINT "movimiento_insumo_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_insumo" ADD CONSTRAINT "movimiento_insumo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_compra_id_compra_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_movimiento_caja_id_movimiento_caja_id_fk" FOREIGN KEY ("movimiento_caja_id") REFERENCES "public"."movimiento_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "pago_proveedor_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta" ADD CONSTRAINT "receta_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta" ADD CONSTRAINT "receta_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso" ADD CONSTRAINT "traspaso_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso" ADD CONSTRAINT "traspaso_origen_id_sucursal_id_fk" FOREIGN KEY ("origen_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso" ADD CONSTRAINT "traspaso_destino_id_sucursal_id_fk" FOREIGN KEY ("destino_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso" ADD CONSTRAINT "traspaso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso_partida" ADD CONSTRAINT "traspaso_partida_traspaso_id_traspaso_id_fk" FOREIGN KEY ("traspaso_id") REFERENCES "public"."traspaso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso_partida" ADD CONSTRAINT "traspaso_partida_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traspaso_partida" ADD CONSTRAINT "traspaso_partida_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compra_negocio_id_vencimiento_index" ON "compra" USING btree ("negocio_id","vencimiento");--> statement-breakpoint
CREATE INDEX "insumo_negocio_id_nombre_index" ON "insumo" USING btree ("negocio_id","nombre");--> statement-breakpoint
CREATE INDEX "movimiento_insumo_insumo_id_creado_en_index" ON "movimiento_insumo" USING btree ("insumo_id","creado_en");