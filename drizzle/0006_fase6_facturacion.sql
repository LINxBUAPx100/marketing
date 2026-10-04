CREATE TABLE "complemento_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comprobante_id" uuid NOT NULL,
	"factura_id" uuid NOT NULL,
	"pago_id" uuid NOT NULL,
	"parcialidad" integer NOT NULL,
	"saldo_anterior" integer NOT NULL,
	"monto" integer NOT NULL,
	"saldo_insoluto" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cliente_id" uuid,
	"serie" text NOT NULL,
	"folio" integer NOT NULL,
	"uuid" text,
	"pac_id" text,
	"receptor" jsonb NOT NULL,
	"conceptos" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"iva" integer NOT NULL,
	"total" integer NOT NULL,
	"metodo_pago" text,
	"forma_pago" text,
	"uso_cfdi" text NOT NULL,
	"global" jsonb,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"motivo_cancelacion" text,
	"sustituida_por" text,
	"cancelada_en" timestamp with time zone,
	"simulada" boolean DEFAULT false NOT NULL,
	"xml" text,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factura_venta" (
	"factura_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	CONSTRAINT "factura_venta_factura_id_venta_id_pk" PRIMARY KEY("factura_id","venta_id")
);
--> statement-breakpoint
ALTER TABLE "producto" ADD COLUMN "clave_sat" text DEFAULT '82121500' NOT NULL;--> statement-breakpoint
ALTER TABLE "producto" ADD COLUMN "clave_unidad" text DEFAULT 'H87' NOT NULL;--> statement-breakpoint
ALTER TABLE "complemento_pago" ADD CONSTRAINT "complemento_pago_comprobante_id_factura_id_fk" FOREIGN KEY ("comprobante_id") REFERENCES "public"."factura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complemento_pago" ADD CONSTRAINT "complemento_pago_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complemento_pago" ADD CONSTRAINT "complemento_pago_pago_id_pago_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_venta" ADD CONSTRAINT "factura_venta_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_venta" ADD CONSTRAINT "factura_venta_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "complemento_pago_pago_id_factura_id_index" ON "complemento_pago" USING btree ("pago_id","factura_id");--> statement-breakpoint
CREATE INDEX "factura_negocio_id_creado_en_index" ON "factura" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "factura_sucursal_id_serie_folio_index" ON "factura" USING btree ("sucursal_id","serie","folio");