CREATE TABLE "bitacora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"usuario_id" uuid,
	"sucursal_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negocio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"razon_social" text,
	"rfc" text,
	"regimen_fiscal" text,
	"codigo_postal" text,
	"direccion" text,
	"telefono" text,
	"correo" text,
	"iva_bp" integer DEFAULT 1600 NOT NULL,
	"precios_incluyen_iva" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rol" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"permisos" text[] DEFAULT '{}' NOT NULL,
	"es_admin" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesion" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sucursal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"prefijo_folio" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"rol_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"telefono" text,
	"password_hash" text NOT NULL,
	"comision_bp" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "usuario_sucursal" (
	"usuario_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	CONSTRAINT "usuario_sucursal_usuario_id_sucursal_id_pk" PRIMARY KEY("usuario_id","sucursal_id")
);
--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rol" ADD CONSTRAINT "rol_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursal" ADD CONSTRAINT "sucursal_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_rol_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bitacora_negocio_id_creado_en_index" ON "bitacora" USING btree ("negocio_id","creado_en");