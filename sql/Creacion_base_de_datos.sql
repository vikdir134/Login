-- =========================================================
-- BASE DE DATOS PRINCIPAL
-- =========================================================
DROP DATABASE gestion_produccion;
CREATE DATABASE IF NOT EXISTS gestion_produccion
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE gestion_produccion;

-- =========================================================
-- TABLAS MAESTRAS / CATÁLOGOS
-- =========================================================
-- CLIENTES (CUSTOMERS): RUC + Razón social + estado (ACTIVO)
CREATE TABLE IF NOT EXISTS CUSTOMERS (
  ID_CUSTOMER   INT AUTO_INCREMENT PRIMARY KEY,      -- PK cliente (customer)
  RUC           VARCHAR(11) NOT NULL UNIQUE,         -- RUC (tax id)
  RAZON_SOCIAL  VARCHAR(60) NOT NULL UNIQUE,         -- Razón social (business name)
  ACTIVO        TINYINT(1) NOT NULL DEFAULT 1,       -- Activo/inactivo (active flag)
  CREATED_AT    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- COLORES (COLORS): catálogo de colores
CREATE TABLE IF NOT EXISTS COLORS (
  ID_COLOR     INT AUTO_INCREMENT PRIMARY KEY,       -- PK color
  DESCRIPCION  VARCHAR(50) NOT NULL                  -- Descripción color
) ENGINE=InnoDB;

-- MATERIALES (MATERIALS): catálogo de materiales
CREATE TABLE IF NOT EXISTS MATERIALS (
  ID_MATERIAL  INT AUTO_INCREMENT PRIMARY KEY,       -- PK material
  DESCRIPCION  VARCHAR(50) NOT NULL                  -- Descripción material
) ENGINE=InnoDB;

-- FACTURAS (INVOICES): catálogo de comprobantes
CREATE TABLE IF NOT EXISTS FACTURAS (
  ID_FACTURA  INT AUTO_INCREMENT PRIMARY KEY,        -- PK factura (invoice)
  CODIGO      VARCHAR(50) NOT NULL,                  -- Código/Nº factura
  CREATED_AT  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- Fecha de creación
) ENGINE=InnoDB;

-- ESTADOS (STATES): estados de pedido
CREATE TABLE IF NOT EXISTS STATES (
  ID_STATE     INT AUTO_INCREMENT PRIMARY KEY,       -- PK estado
  DESCRIPCION  VARCHAR(50) NOT NULL UNIQUE           -- Descripción del estado
) ENGINE=InnoDB;

-- Semilla de estados típicos
INSERT IGNORE INTO STATES (DESCRIPCION) VALUES
('PENDIENTE'),       -- (PENDING)
('EN_PROCESO'),      -- (IN_PROGRESS)
('ENTREGADO'),       -- (DELIVERED)
('CANCELADO');       -- (CANCELLED)

-- ESPACIOS / UBICACIONES (SPACES): zonas de almacén
CREATE TABLE IF NOT EXISTS SPACES (
  ID_SPACE  INT AUTO_INCREMENT PRIMARY KEY,          -- PK espacio (location)
  NOMBRE    VARCHAR(50) NOT NULL UNIQUE              -- Nombre del espacio
) ENGINE=InnoDB;

-- PRODUCTOS TERMINADOS (PRODUCTS)
CREATE TABLE IF NOT EXISTS PRODUCTS (
  ID_PRODUCT     INT AUTO_INCREMENT PRIMARY KEY,     -- PK producto
  TIPO_PRODUCTO  VARCHAR(50) NOT NULL,               -- Tipo
  DIAMETER       VARCHAR(20) NOT NULL,               -- Diámetro
  DESCRIPCION    VARCHAR(100) NOT NULL,              -- Descripción
  INDEX idx_products_desc (DESCRIPCION)
) ENGINE=InnoDB;

-- MATERIA PRIMA (PRIMARY_MATERIALS): material + color + denier
CREATE TABLE IF NOT EXISTS PRIMARY_MATERIALS (
  ID_PRIMATER  INT AUTO_INCREMENT PRIMARY KEY,       -- PK materia prima
  ID_MATERIAL  INT NOT NULL,                         -- FK -> MATERIALS
  ID_COLOR     INT NULL,                             -- FK -> COLORS
  DESCRIPCION  VARCHAR(50),                          -- Descripción adicional
  DENIER       INT,                                  -- Denier (gramaje)
  CONSTRAINT fk_pm_material FOREIGN KEY (ID_MATERIAL) REFERENCES MATERIALS(ID_MATERIAL),
  CONSTRAINT fk_pm_color    FOREIGN KEY (ID_COLOR)    REFERENCES COLORS(ID_COLOR)
) ENGINE=InnoDB;

-- =========================================================
-- PEDIDOS (ORDERS) Y DETALLE (DESCRIPTION_ORDER)
-- =========================================================
CREATE TABLE IF NOT EXISTS ORDERS (
  ID_ORDER     INT AUTO_INCREMENT PRIMARY KEY,       -- PK pedido
  ID_CUSTOMER  INT NOT NULL,                         -- FK -> CUSTOMERS
  ID_STATE     INT NOT NULL,                         -- FK -> STATES
  FECHA        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Fecha creación
  CREATED_BY   INT UNSIGNED NULL,                    -- (opcional) FK -> users (quién creó)
  CONSTRAINT fk_orders_customer FOREIGN KEY (ID_CUSTOMER) REFERENCES CUSTOMERS(ID_CUSTOMER),
  CONSTRAINT fk_orders_state    FOREIGN KEY (ID_STATE)    REFERENCES STATES(ID_STATE)
) ENGINE=InnoDB;

-- índices útiles
ALTER TABLE ORDERS
  ADD INDEX idx_orders_state (ID_STATE, FECHA),
  ADD INDEX idx_orders_customer (ID_CUSTOMER, FECHA);

-- DETALLE DE PEDIDO
CREATE TABLE IF NOT EXISTS DESCRIPTION_ORDER (
  ID_DESCRIPTION_ORDER INT AUTO_INCREMENT PRIMARY KEY,  -- PK detalle pedido
  ID_PRODUCT           INT NOT NULL,                    -- FK -> PRODUCTS
  ID_ORDER             INT NOT NULL,                    -- FK -> ORDERS
  PESO                 DECIMAL(10,2) NOT NULL,          -- Peso solicitado
  PRESENTACION         DECIMAL(10,2) NOT NULL,          -- Presentación/rollo/caja
  OBSERVACION          VARCHAR(200) NULL,               -- Observación libre
  CONSTRAINT fk_dorder_product FOREIGN KEY (ID_PRODUCT) REFERENCES PRODUCTS(ID_PRODUCT),
  CONSTRAINT fk_dorder_order   FOREIGN KEY (ID_ORDER)   REFERENCES ORDERS(ID_ORDER),
  INDEX idx_desc_order (ID_ORDER, ID_PRODUCT)
) ENGINE=InnoDB;

-- =========================================================
-- STOCK / MOVIMIENTOS
-- =========================================================
-- Stock por zona de materia prima
CREATE TABLE IF NOT EXISTS STOCK_ZONE (
  ID_STOCK_ZONE INT AUTO_INCREMENT PRIMARY KEY,
  ID_SPACE      INT NOT NULL,                          -- FK -> SPACES
  ID_PRIMATER   INT NOT NULL,                          -- FK -> PRIMARY_MATERIALS
  PESO          DECIMAL(10,2) NOT NULL,                -- Peso actual
  FECHA         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  OBSERVACION   VARCHAR(200),
  CONSTRAINT fk_sz_space    FOREIGN KEY (ID_SPACE)    REFERENCES SPACES(ID_SPACE),
  CONSTRAINT fk_sz_primater FOREIGN KEY (ID_PRIMATER) REFERENCES PRIMARY_MATERIALS(ID_PRIMATER),
  INDEX idx_sz_space_primater (ID_SPACE, ID_PRIMATER)
) ENGINE=InnoDB;

-- Movimientos de materia prima entre zonas
CREATE TABLE IF NOT EXISTS STOCK_MOVEMENTS_PRIMARY (
  ID_MOVEMENT         INT AUTO_INCREMENT PRIMARY KEY,
  ID_ORIGIN_ZONE      INT NOT NULL,                    -- FK -> SPACES
  ID_DESTINATION_ZONE INT NOT NULL,                    -- FK -> SPACES
  ID_PRIMATER         INT NOT NULL,                    -- FK -> PRIMARY_MATERIALS
  CANTIDAD            DECIMAL(10,2) NOT NULL,
  FECHA               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  OBSERVACION         VARCHAR(200),
  CONSTRAINT fk_smp_origin      FOREIGN KEY (ID_ORIGIN_ZONE)      REFERENCES SPACES(ID_SPACE),
  CONSTRAINT fk_smp_destination FOREIGN KEY (ID_DESTINATION_ZONE) REFERENCES SPACES(ID_SPACE),
  CONSTRAINT fk_smp_primater    FOREIGN KEY (ID_PRIMATER)         REFERENCES PRIMARY_MATERIALS(ID_PRIMATER),
  INDEX idx_smp_fecha (FECHA)
) ENGINE=InnoDB;

-- Stock de producto terminado
CREATE TABLE IF NOT EXISTS STOCK_FINISHED_PRODUCT (
  ID_PRO     INT AUTO_INCREMENT PRIMARY KEY,
  ID_PRODUCT INT NOT NULL,                             -- FK -> PRODUCTS
  ID_SPACE   INT NOT NULL,                             -- FK -> SPACES
  PESO       DECIMAL(10,2) NOT NULL,
  FECHA      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sfp_product FOREIGN KEY (ID_PRODUCT) REFERENCES PRODUCTS(ID_PRODUCT),
  CONSTRAINT fk_sfp_space   FOREIGN KEY (ID_SPACE)   REFERENCES SPACES(ID_SPACE),
  INDEX idx_stock_product_space (ID_PRODUCT, ID_SPACE)
) ENGINE=InnoDB;

-- Composición del producto (receta)
CREATE TABLE IF NOT EXISTS PRODUCT_COMPOSITION (
  ID_COMPOSITION INT AUTO_INCREMENT PRIMARY KEY,
  ID_PRODUCT     INT NOT NULL,                         -- FK -> PRODUCTS
  ID_PRIMATER    INT NOT NULL,                         -- FK -> PRIMARY_MATERIALS
  ZONE           ENUM('TRONCO','ALMA','CUBIERTA') NOT NULL,  -- Zona fija
  PERCENTAGE     DECIMAL(5,2) NOT NULL,               -- 0..100
  CONSTRAINT fk_pc_product  FOREIGN KEY (ID_PRODUCT)  REFERENCES PRODUCTS(ID_PRODUCT),
  CONSTRAINT fk_pc_primater FOREIGN KEY (ID_PRIMATER) REFERENCES PRIMARY_MATERIALS(ID_PRIMATER),
  CONSTRAINT chk_pc_percentage CHECK (PERCENTAGE >= 0 AND PERCENTAGE <= 100),
  INDEX idx_pc_product_zone (ID_PRODUCT, ZONE)
) ENGINE=InnoDB;

-- =========================================================
-- ENTREGAS (DELIVERIES) Y DETALLE
-- =========================================================
CREATE TABLE IF NOT EXISTS ORDER_DELIVERY (
  ID_ORDER_DELIVERY INT AUTO_INCREMENT PRIMARY KEY,
  ID_ORDER          INT NOT NULL,                      -- FK -> ORDERS
  ID_FACTURA        INT NULL,                          -- FK -> FACTURAS
  FECHA             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CREATED_BY        INT UNSIGNED NULL,                 -- (opcional) FK -> users
  CONSTRAINT fk_od_order   FOREIGN KEY (ID_ORDER)   REFERENCES ORDERS(ID_ORDER),
  CONSTRAINT fk_od_factura FOREIGN KEY (ID_FACTURA) REFERENCES FACTURAS(ID_FACTURA),
  INDEX idx_delivery_date (FECHA),
  INDEX idx_delivery_order (ID_ORDER)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DESCRIPTION_DELIVERY (
  ID_DESCRIPTION_DELIVERY INT AUTO_INCREMENT PRIMARY KEY,
  ID_ORDER_DELIVERY       INT NOT NULL,                -- FK -> ORDER_DELIVERY
  ID_DESCRIPTION_ORDER    INT NOT NULL,                -- FK -> DESCRIPTION_ORDER
  PESO                    DECIMAL(10,2) NOT NULL,
  DESCRIPCION             VARCHAR(100),
  UNIT_PRICE              DECIMAL(10,2) NULL,          -- Precio aplicado (congelado)
  CURRENCY                CHAR(3) NOT NULL DEFAULT 'PEN',
  SUBTOTAL                DECIMAL(12,2)
     GENERATED ALWAYS AS (PESO * IFNULL(UNIT_PRICE,0)) STORED,
  CONSTRAINT fk_dd_delivery   FOREIGN KEY (ID_ORDER_DELIVERY)   REFERENCES ORDER_DELIVERY(ID_ORDER_DELIVERY),
  CONSTRAINT fk_dd_descorder  FOREIGN KEY (ID_DESCRIPTION_ORDER) REFERENCES DESCRIPTION_ORDER(ID_DESCRIPTION_ORDER),
  INDEX idx_dd_delivery (ID_ORDER_DELIVERY)
) ENGINE=InnoDB;

-- =========================================================
-- LISTA DE PRECIOS POR CLIENTE/PRODUCTO (HISTÓRICA)
-- =========================================================
CREATE TABLE IF NOT EXISTS CUSTOMER_PRODUCT_PRICES (
  ID_PRICE     INT AUTO_INCREMENT PRIMARY KEY,
  ID_CUSTOMER  INT NOT NULL,                           -- FK -> CUSTOMERS
  ID_PRODUCT   INT NOT NULL,                           -- FK -> PRODUCTS
  PRICE        DECIMAL(10,2) NOT NULL,
  CURRENCY     CHAR(3) NOT NULL DEFAULT 'PEN',
  VALID_FROM   DATE NOT NULL,                          -- Vigente desde
  VALID_TO     DATE NULL,                              -- Vigente hasta (NULL = vigente)
  CONSTRAINT fk_cpp_customer FOREIGN KEY (ID_CUSTOMER) REFERENCES CUSTOMERS(ID_CUSTOMER),
  CONSTRAINT fk_cpp_product  FOREIGN KEY (ID_PRODUCT)  REFERENCES PRODUCTS(ID_PRODUCT),
  INDEX idx_cpp_customer_product (ID_CUSTOMER, ID_PRODUCT, VALID_FROM),
  UNIQUE KEY uq_cpp_customer_product_from (ID_CUSTOMER, ID_PRODUCT, VALID_FROM)
) ENGINE=InnoDB;

-- 🔔 Trigger: al insertar un nuevo precio, cierra el anterior (si estaba abierto)
DELIMITER $$
CREATE TRIGGER trg_cpp_close_previous
BEFORE INSERT ON CUSTOMER_PRODUCT_PRICES
FOR EACH ROW
BEGIN
  -- Cierra cualquier precio "abierto" (VALID_TO IS NULL) del mismo cliente+producto
  UPDATE CUSTOMER_PRODUCT_PRICES
     SET VALID_TO = DATE_SUB(NEW.VALID_FROM, INTERVAL 1 DAY)
   WHERE ID_CUSTOMER = NEW.ID_CUSTOMER
     AND ID_PRODUCT  = NEW.ID_PRODUCT
     AND (VALID_TO IS NULL OR VALID_TO >= NEW.VALID_FROM);
END$$
DELIMITER ;

-- =========================================================
-- AUTENTICACIÓN / AUTORIZACIÓN
-- =========================================================
CREATE TABLE IF NOT EXISTS roles (
  id   TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- PK rol
  name VARCHAR(32) NOT NULL UNIQUE                   -- Nombre de rol
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (name) VALUES
('ALMACENERO'), ('PRODUCCION'), ('JEFE'), ('ADMINISTRADOR');

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- PK usuario
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(30) NULL,
  role_id       TINYINT UNSIGNED NOT NULL,                -- FK -> roles
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_role  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_role_id (role_id)
) ENGINE=InnoDB;

-- (Opcional) vincular quién crea pedidos/entregas (columnas ya existen)
-- ALTER TABLE ORDERS         ADD CONSTRAINT fk_orders_user   FOREIGN KEY (CREATED_BY) REFERENCES users(id);
-- ALTER TABLE ORDER_DELIVERY ADD CONSTRAINT fk_delivery_user FOREIGN KEY (CREATED_BY) REFERENCES users(id);

-- =========================================================
-- GASTOS Y TIPOS DE GASTO
-- =========================================================
CREATE TABLE IF NOT EXISTS EXPENSE_TYPES (
  ID_EXPENSE_TYPE INT AUTO_INCREMENT PRIMARY KEY,     -- PK tipo de gasto
  NAME            VARCHAR(80)  NOT NULL,              -- Nombre
  PARENT_ID       INT NULL,                           -- Jerarquía (padre)
  ACTIVE          TINYINT(1) NOT NULL DEFAULT 1,      -- Activo/inactivo
  UNIQUE KEY uq_expense_types_name (NAME),
  CONSTRAINT fk_expense_types_parent
    FOREIGN KEY (PARENT_ID) REFERENCES EXPENSE_TYPES(ID_EXPENSE_TYPE)
) ENGINE=InnoDB;

-- Semilla de categorías base
INSERT IGNORE INTO EXPENSE_TYPES (NAME) VALUES
('Materia Prima'), ('Servicios'), ('Sueldos'),
('Transporte'), ('Mantenimiento'), ('Impuestos'), ('Administración');

-- Subcategorías ejemplo bajo "Servicios"
INSERT IGNORE INTO EXPENSE_TYPES (NAME, PARENT_ID)
SELECT 'Luz', t.ID_EXPENSE_TYPE FROM EXPENSE_TYPES t WHERE t.NAME='Servicios';
INSERT IGNORE INTO EXPENSE_TYPES (NAME, PARENT_ID)
SELECT 'Agua', t.ID_EXPENSE_TYPE FROM EXPENSE_TYPES t WHERE t.NAME='Servicios';
INSERT IGNORE INTO EXPENSE_TYPES (NAME, PARENT_ID)
SELECT 'Internet', t.ID_EXPENSE_TYPE FROM EXPENSE_TYPES t WHERE t.NAME='Servicios';

CREATE TABLE IF NOT EXISTS EXPENSES (
  ID_EXPENSE      INT AUTO_INCREMENT PRIMARY KEY,        -- PK gasto
  ID_EXPENSE_TYPE INT NOT NULL,                          -- FK -> EXPENSE_TYPES
  EXPENSE_DATE    DATE NOT NULL,                         -- Fecha del gasto
  DESCRIPTION     VARCHAR(200) NULL,                     -- Descripción
  SUPPLIER_NAME   VARCHAR(120) NULL,                     -- Proveedor
  INVOICE_NUMBER  VARCHAR(50)  NULL,                     -- Nº factura/recibo
  PAYMENT_METHOD  ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL DEFAULT 'EFECTIVO',
  AMOUNT_NET      DECIMAL(12,2) NOT NULL,                -- Monto neto
  TAX_AMOUNT      DECIMAL(12,2) NOT NULL DEFAULT 0.00,   -- Impuesto
  CURRENCY        CHAR(3) NOT NULL DEFAULT 'PEN',        -- Moneda
  ATTACHMENT_URL  VARCHAR(255) NULL,                     -- URL al comprobante
  ID_ORDER        INT NULL,                              -- (opcional) FK -> ORDERS
  CREATED_BY      INT UNSIGNED NULL,                     -- (opcional) FK -> users
  CREATED_AT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_expenses_type  FOREIGN KEY (ID_EXPENSE_TYPE) REFERENCES EXPENSE_TYPES(ID_EXPENSE_TYPE),
  CONSTRAINT fk_expenses_order FOREIGN KEY (ID_ORDER)        REFERENCES ORDERS(ID_ORDER),
  CONSTRAINT fk_expenses_user  FOREIGN KEY (CREATED_BY)      REFERENCES users(id),

  INDEX idx_expense_date (EXPENSE_DATE),
  INDEX idx_expense_type (ID_EXPENSE_TYPE),
  INDEX idx_expense_order (ID_ORDER),
  INDEX idx_expense_created_by (CREATED_BY)
) ENGINE=InnoDB;

-- =========================================================
-- PAGOS DE CLIENTES (HISTORIAL POR PEDIDO)
-- =========================================================
CREATE TABLE IF NOT EXISTS PAYMENTS (
  ID_PAYMENT    INT AUTO_INCREMENT PRIMARY KEY,          -- PK pago
  ID_ORDER      INT NOT NULL,                            -- FK -> ORDERS (a qué pedido corresponde)
  ID_CUSTOMER   INT NOT NULL,                            -- FK -> CUSTOMERS (redundante útil para reportes)
  PAYMENT_DATE  DATE NOT NULL,                           -- Fecha del pago
  AMOUNT        DECIMAL(12,2) NOT NULL,                  -- Monto pagado
  CURRENCY      CHAR(3) NOT NULL DEFAULT 'PEN',          -- Moneda
  METHOD        ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL DEFAULT 'EFECTIVO',
  REFERENCE     VARCHAR(100) NULL,                       -- Nº operación / banco
  OBSERVACION   VARCHAR(200) NULL,                       -- Nota opcional
  CREATED_BY    INT UNSIGNED NULL,                       -- (opcional) FK -> users
  CREATED_AT    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pay_order    FOREIGN KEY (ID_ORDER)    REFERENCES ORDERS(ID_ORDER),
  CONSTRAINT fk_pay_customer FOREIGN KEY (ID_CUSTOMER) REFERENCES CUSTOMERS(ID_CUSTOMER),
  CONSTRAINT fk_pay_user     FOREIGN KEY (CREATED_BY)  REFERENCES users(id),

  INDEX idx_pay_order (ID_ORDER),
  INDEX idx_pay_customer (ID_CUSTOMER),
  INDEX idx_pay_date (PAYMENT_DATE)
) ENGINE=InnoDB;


USE gestion_produccion;

-- =========================================================
-- 0) Zona estándar para ingresos de compras: RECEPCION
-- =========================================================
-- Si no existe, la creamos. Servirá como ORIGEN en el movimiento de entrada.
INSERT IGNORE INTO SPACES (NOMBRE) VALUES ('RECEPCION');

-- Puedes crear también un almacén principal (si no tienes uno):
INSERT IGNORE INTO SPACES (NOMBRE) VALUES ('ALMACEN_PRINCIPAL');

-- =========================================================
-- 1) PROVEEDORES
-- =========================================================
CREATE TABLE IF NOT EXISTS SUPPLIERS (
  ID_SUPPLIER     INT AUTO_INCREMENT PRIMARY KEY,     -- PK proveedor
  NAME            VARCHAR(120) NOT NULL,              -- Razón social / nombre comercial
  RUC             VARCHAR(20),                        -- RUC / tax id
  ADDRESS         VARCHAR(200),
  PHONE           VARCHAR(20),
  EMAIL           VARCHAR(100),
  CONTACT_PERSON  VARCHAR(100),
  ACTIVE          TINYINT(1) NOT NULL DEFAULT 1,      -- Activo/inactivo
  CREATED_AT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suppliers_name (NAME),
  INDEX idx_suppliers_ruc (RUC)
) ENGINE=InnoDB;

-- =========================================================
-- 2) COMPRAS (CABECERA)
-- =========================================================
-- Documento = factura/boleta/guía/otro. Unicidad por proveedor+tipo+numero para evitar duplicados.
CREATE TABLE IF NOT EXISTS PURCHASES (
  ID_PURCHASE      INT AUTO_INCREMENT PRIMARY KEY,   -- PK compra
  ID_SUPPLIER      INT NOT NULL,                     -- FK -> SUPPLIERS
  DOCUMENT_TYPE    ENUM('FACTURA','BOLETA','GUIA','OTRO') NOT NULL,
  DOCUMENT_NUMBER  VARCHAR(50) NOT NULL,
  DOCUMENT_DATE    DATE NOT NULL,
  TOTAL_NET        DECIMAL(12,2) NOT NULL DEFAULT 0, -- Neto (suma de ítems)
  TAX_AMOUNT       DECIMAL(12,2) NOT NULL DEFAULT 0, -- Impuesto (IGV, etc.)
  TOTAL_AMOUNT     DECIMAL(12,2) NOT NULL DEFAULT 0, -- Neto + impuesto
  CURRENCY         CHAR(3) NOT NULL DEFAULT 'PEN',
  NOTES            VARCHAR(255) NULL,                -- Observación/nota
  CREATED_BY       INT UNSIGNED NULL,                -- (opcional) FK -> users (quién registró)
  CREATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_purchases_supplier FOREIGN KEY (ID_SUPPLIER) REFERENCES SUPPLIERS(ID_SUPPLIER),
  CONSTRAINT fk_purchases_user     FOREIGN KEY (CREATED_BY)  REFERENCES users(id),

  UNIQUE KEY uq_purchase_doc (ID_SUPPLIER, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  INDEX idx_purchase_date (DOCUMENT_DATE),
  INDEX idx_purchase_supplier (ID_SUPPLIER)
) ENGINE=InnoDB;

-- =========================================================
-- 3) DETALLE DE COMPRA (MATERIAS PRIMAS)
-- =========================================================
-- Cada renglón es un material (PRIMARY_MATERIALS) comprado con cantidad y precio unitario.
CREATE TABLE IF NOT EXISTS PURCHASE_ITEMS (
  ID_PURCHASE_ITEM INT AUTO_INCREMENT PRIMARY KEY,   -- PK item
  ID_PURCHASE      INT NOT NULL,                     -- FK -> PURCHASES
  ID_PRIMATER      INT NOT NULL,                     -- FK -> PRIMARY_MATERIALS
  QUANTITY         DECIMAL(12,3) NOT NULL,           -- Cantidad comprada (kg)
  UNIT_PRICE       DECIMAL(12,2) NOT NULL,           -- Precio unitario
  TOTAL_PRICE      DECIMAL(12,2) NOT NULL,           -- QUANTITY * UNIT_PRICE
  NOTES            VARCHAR(255) NULL,

  CONSTRAINT fk_pitems_purchase FOREIGN KEY (ID_PURCHASE) REFERENCES PURCHASES(ID_PURCHASE),
  CONSTRAINT fk_pitems_primater FOREIGN KEY (ID_PRIMATER) REFERENCES PRIMARY_MATERIALS(ID_PRIMATER),

  INDEX idx_pitems_purchase (ID_PURCHASE),
  INDEX idx_pitems_primater (ID_PRIMATER)
) ENGINE=InnoDB;

-- (Opcional) Chequeo de coherencia del total en cabecera: lo puedes mantener en backend,
-- sumando PURCHASE_ITEMS y guardando TOTAL_NET/TAX/TOTAL en PURCHASES.

-- =========================================================
-- 4) VÍNCULO CON MOVIMIENTOS DE STOCK (ingresos por compra)
-- =========================================================
-- Agregamos una columna opcional a STOCK_MOVEMENTS_PRIMARY para rastrear de qué compra proviene el ingreso.
ALTER TABLE STOCK_MOVEMENTS_PRIMARY
  ADD COLUMN SOURCE_PURCHASE INT NULL,
  ADD CONSTRAINT fk_smp_purchase FOREIGN KEY (SOURCE_PURCHASE) REFERENCES PURCHASES(ID_PURCHASE);

-- Para acelerar reportes por compra:
ALTER TABLE STOCK_MOVEMENTS_PRIMARY
  ADD INDEX idx_smp_purchase (SOURCE_PURCHASE);

-- =========================================================
-- 5) TRIGGER OPCIONAL: generar movimiento de stock al confirmar compra
-- =========================================================
-- ⚠️ Alternativas:
--   A) Manejarlo desde el backend: cuando insertas la compra y sus items, generas luego los movimientos.
--   B) Manejarlo con TRIGGER: al insertar cada PURCHASE_ITEM, crear el movimiento en SMP automáticamente.
-- Escoge UNA. Abajo dejo B) por comodidad. Si prefieres A), NO crees el trigger.

-- Necesitamos los IDs de las zonas para el movimiento:
--   - ORIGEN: RECEPCION
--   - DESTINO: ALMACEN_PRINCIPAL (ajústalo si usas otro)
-- Si cambias los nombres, actualiza las subconsultas del trigger.

DELIMITER $$

DROP TRIGGER IF EXISTS trg_purchase_item_to_stock $$
CREATE TRIGGER trg_purchase_item_to_stock
AFTER INSERT ON PURCHASE_ITEMS
FOR EACH ROW
BEGIN
  DECLARE vOrigin INT DEFAULT NULL;
  DECLARE vDest   INT DEFAULT NULL;

  -- Busca IDs de espacios por nombre
  SELECT ID_SPACE INTO vOrigin FROM SPACES WHERE NOMBRE = 'RECEPCION' LIMIT 1;
  SELECT ID_SPACE INTO vDest   FROM SPACES WHERE NOMBRE = 'ALMACEN_PRINCIPAL' LIMIT 1;

  -- Solo inserta movimiento si ambas zonas existen
  IF vOrigin IS NOT NULL AND vDest IS NOT NULL THEN
    INSERT INTO STOCK_MOVEMENTS_PRIMARY
      (ID_ORIGIN_ZONE, ID_DESTINATION_ZONE, ID_PRIMATER, CANTIDAD, FECHA, OBSERVACION, SOURCE_PURCHASE)
    VALUES
      (vOrigin, vDest, NEW.ID_PRIMATER, NEW.QUANTITY, NOW(),
       CONCAT('Ingreso por compra #', NEW.ID_PURCHASE), NEW.ID_PURCHASE);
  END IF;
END $$

DELIMITER ;

-- =========================================================
-- 6) VISTAS ÚTILES (reportes)
-- =========================================================
-- A) Ingresos físicos de materia prima por mes (desde compras)
CREATE OR REPLACE VIEW V_PRIMARY_PURCHASES_QTY AS
SELECT
  DATE_FORMAT(p.DOCUMENT_DATE, '%Y-%m') AS periodo,     -- ej. 2025-08
  m.DESCRIPCION                         AS material,
  c.DESCRIPCION                         AS color,
  SUM(pi.QUANTITY)                      AS cantidad_total
FROM PURCHASES p
JOIN PURCHASE_ITEMS pi  ON pi.ID_PURCHASE = p.ID_PURCHASE
JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = pi.ID_PRIMATER
JOIN MATERIALS m       ON m.ID_MATERIAL = pm.ID_MATERIAL
LEFT JOIN COLORS c     ON c.ID_COLOR    = pm.ID_COLOR
GROUP BY DATE_FORMAT(p.DOCUMENT_DATE, '%Y-%m'), m.DESCRIPCION, c.DESCRIPCION;

-- B) Gastos en compras de materia prima por mes (financiero)
--    Si registras las compras también en EXPENSES con tipo "Materia Prima",
--    este view no es necesario. Pero aquí va uno directo de PURCHASES:
CREATE OR REPLACE VIEW V_PRIMARY_PURCHASES_AMOUNT AS
SELECT
  DATE_FORMAT(p.DOCUMENT_DATE, '%Y-%m') AS periodo,
  s.NAME       AS proveedor,
  SUM(p.TOTAL_AMOUNT) AS total_mensual
FROM PURCHASES p
JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
GROUP BY DATE_FORMAT(p.DOCUMENT_DATE, '%Y-%m'), s.NAME;

-- C) Ingresos a stock originados en compras (para auditoría rápida)
CREATE OR REPLACE VIEW V_STOCK_IN_FROM_PURCHASE AS
SELECT
  smp.ID_MOVEMENT,
  smp.FECHA,
  so.NOMBRE AS origen,
  sd.NOMBRE AS destino,
  m.DESCRIPCION AS material,
  c.DESCRIPCION AS color,
  smp.CANTIDAD,
  p.ID_PURCHASE,
  s.NAME AS proveedor,
  CONCAT(p.DOCUMENT_TYPE, ' ', p.DOCUMENT_NUMBER) AS documento
FROM STOCK_MOVEMENTS_PRIMARY smp
JOIN SPACES so ON so.ID_SPACE = smp.ID_ORIGIN_ZONE
JOIN SPACES sd ON sd.ID_SPACE = smp.ID_DESTINATION_ZONE
JOIN PRIMARY_MATERIALS pm ON pm.ID_PRIMATER = smp.ID_PRIMATER
JOIN MATERIALS m ON m.ID_MATERIAL = pm.ID_MATERIAL
LEFT JOIN COLORS c ON c.ID_COLOR = pm.ID_COLOR
LEFT JOIN PURCHASES p ON p.ID_PURCHASE = smp.SOURCE_PURCHASE
LEFT JOIN SUPPLIERS s ON s.ID_SUPPLIER = p.ID_SUPPLIER
WHERE smp.SOURCE_PURCHASE IS NOT NULL
ORDER BY smp.FECHA DESC;

INSERT IGNORE INTO SPACES (NOMBRE) VALUES ('RECEPCION'), ('ALMACEN_PRINCIPAL');

ALTER TABLE CUSTOMER_PRODUCT_PRICES
  ADD COLUMN IS_CURRENT TINYINT(1)
  GENERATED ALWAYS AS (CASE WHEN VALID_TO IS NULL THEN 1 ELSE 0 END) STORED;

CREATE UNIQUE INDEX uq_cpp_one_current
  ON CUSTOMER_PRODUCT_PRICES (ID_CUSTOMER, ID_PRODUCT, IS_CURRENT);
  
  ALTER TABLE ORDER_DELIVERY        ADD INDEX idx_od_order_fecha (ID_ORDER, FECHA);

  USE gestion_produccion;

-- =========================================================
-- 1) Subir AUTO_INCREMENT de las tablas que vamos a poblar
--    (para que nuevos inserts automáticos empiecen en 10)
-- =========================================================
ALTER TABLE SPACES                   AUTO_INCREMENT = 10;
ALTER TABLE MATERIALS                AUTO_INCREMENT = 10;
ALTER TABLE COLORS                   AUTO_INCREMENT = 10;
ALTER TABLE PRIMARY_MATERIALS        AUTO_INCREMENT = 10;
ALTER TABLE PRODUCTS                 AUTO_INCREMENT = 10;
ALTER TABLE CUSTOMERS                AUTO_INCREMENT = 10;
ALTER TABLE SUPPLIERS                AUTO_INCREMENT = 10;
ALTER TABLE PURCHASES                AUTO_INCREMENT = 10;
ALTER TABLE PURCHASE_ITEMS           AUTO_INCREMENT = 10;
ALTER TABLE ORDERS                   AUTO_INCREMENT = 10;
ALTER TABLE DESCRIPTION_ORDER        AUTO_INCREMENT = 10;
ALTER TABLE ORDER_DELIVERY           AUTO_INCREMENT = 10;
ALTER TABLE DESCRIPTION_DELIVERY     AUTO_INCREMENT = 10;
ALTER TABLE CUSTOMER_PRODUCT_PRICES  AUTO_INCREMENT = 10;
ALTER TABLE PAYMENTS                 AUTO_INCREMENT = 10;
ALTER TABLE EXPENSES                 AUTO_INCREMENT = 10;

-- =========================================================
-- 2) Catálogos base (espacios, materiales, colores, productos)
-- =========================================================

-- SPACES (zonas físicas) — requeridas por el trigger
INSERT IGNORE INTO SPACES (ID_SPACE, NOMBRE) VALUES
(10, 'RECEPCION'),
(11, 'ALMACEN_PRINCIPAL'),
(12, 'PRODUCCION');

-- MATERIALS (catálogo de materiales)
INSERT IGNORE INTO MATERIALS (ID_MATERIAL, DESCRIPCION) VALUES
(10, 'Polipropileno'),
(11, 'Poliéster');

-- COLORS (catálogo de colores)
INSERT IGNORE INTO COLORS (ID_COLOR, DESCRIPCION) VALUES
(10, 'Blanco'),
(11, 'Negro');

-- PRIMARY_MATERIALS (materia prima: material + color + denier)
INSERT IGNORE INTO PRIMARY_MATERIALS (ID_PRIMATER, ID_MATERIAL, ID_COLOR, DESCRIPCION, DENIER) VALUES
(10, 10, 10, 'PP Blanco 600D', 600),
(11, 11, 11, 'PET Negro 800D', 800);

-- PRODUCTS (productos terminados)
INSERT IGNORE INTO PRODUCTS (ID_PRODUCT, TIPO_PRODUCTO, DIAMETER, DESCRIPCION) VALUES
(10, 'Soga', '12mm', 'Soga 12mm polipropileno'),
(11, 'Cuerda', '8mm',  'Cuerda 8mm poliéster');

-- =========================================================
-- 3) Clientes y proveedores
-- =========================================================

-- CUSTOMERS (clientes)
INSERT IGNORE INTO CUSTOMERS (ID_CUSTOMER, RUC, RAZON_SOCIAL, ACTIVO) VALUES
(10, '20600000010', 'ACME SAC', 1),
(11, '20600000011', 'Textiles Andinos SAC', 1);

-- SUPPLIERS (proveedores)
INSERT IGNORE INTO SUPPLIERS (ID_SUPPLIER, NAME, RUC, ADDRESS, PHONE, EMAIL, CONTACT_PERSON, ACTIVE) VALUES
(10, 'ProveePeru SAC', '20555555551', 'Av. Industrial 123', '012345678', 'ventas@proveeperu.com', 'María López', 1);

-- =========================================================
-- 4) Lista de precios por cliente y producto (histórica)
--    (Necesaria para calcular UNIT_PRICE al crear entregas
--     si no envías precio explícito)
-- =========================================================
-- Vigente desde 2025-01-01, sin VALID_TO (vigente)
SHOW TRIGGERS WHERE `Table` = 'CUSTOMER_PRODUCT_PRICES';
DROP TRIGGER IF EXISTS trg_cpp_close_previous;
INSERT IGNORE INTO CUSTOMER_PRODUCT_PRICES
(ID_PRICE, ID_CUSTOMER, ID_PRODUCT, PRICE, CURRENCY, VALID_FROM, VALID_TO) VALUES
(10, 10, 10, 12.50, 'PEN', '2025-01-01', NULL), -- ACME SAC, Soga 12mm
(11, 10, 11,  9.80, 'PEN', '2025-01-01', NULL); -- ACME SAC, Cuerda 8mm

-- =========================================================
-- 5) Compras (cabecera + ítems)
--    Esto dispara el TRIGGER y crea movimientos de stock
--    en STOCK_MOVEMENTS_PRIMARY con SOURCE_PURCHASE
-- =========================================================
-- Compra #10: FACTURA F001-10 a ProveePeru
INSERT IGNORE INTO PURCHASES
(ID_PURCHASE, ID_SUPPLIER, DOCUMENT_TYPE, DOCUMENT_NUMBER, DOCUMENT_DATE,
 TOTAL_NET, TAX_AMOUNT, TOTAL_AMOUNT, CURRENCY, NOTES, CREATED_BY)
VALUES
(10, 10, 'FACTURA', 'F001-10', '2025-08-10',  925.00, 166.50, 1091.50, 'PEN', 'Compra inicial agosto', NULL);

-- Ítems de la compra #10 (estos disparan el trigger)
INSERT IGNORE INTO PURCHASE_ITEMS
(ID_PURCHASE_ITEM, ID_PURCHASE, ID_PRIMATER, QUANTITY, UNIT_PRICE, TOTAL_PRICE, NOTES)
VALUES
(10, 10, 10, 150.00, 5.50, 825.00, 'PP Blanco'),
(11, 10, 11,  50.00, 2.00, 100.00, 'PET Negro');

-- =========================================================
-- 6) Pedidos (cabecera + detalle)
--    Estados: usamos subquery para ID_STATE según DESCRIPCION
--    Asegúrate que STATES tenga PENDIENTE/EN_PROCESO/ENTREGADO/CANCELADO
-- =========================================================
-- Pedido #10 para ACME SAC en estado PENDIENTE
INSERT IGNORE INTO ORDERS
(ID_ORDER, ID_CUSTOMER, ID_STATE, FECHA, CREATED_BY)
VALUES
(10, 10,
 (SELECT ID_STATE FROM STATES WHERE DESCRIPCION='PENDIENTE' LIMIT 1),
 '2025-08-12 09:00:00', NULL);

-- Líneas del pedido #10
INSERT IGNORE INTO DESCRIPTION_ORDER
(ID_DESCRIPTION_ORDER, ID_PRODUCT, ID_ORDER, PESO, PRESENTACION)
VALUES
(10, 10, 10, 200.00, 25.00), -- Soga 12mm, 200 kg, presentación 25
(11, 11, 10, 100.00, 10.00); -- Cuerda 8mm, 100 kg, presentación 10

-- (Opcional) Pedido #11 para el mismo cliente en EN_PROCESO
INSERT IGNORE INTO ORDERS
(ID_ORDER, ID_CUSTOMER, ID_STATE, FECHA, CREATED_BY)
VALUES
(11, 10,
 (SELECT ID_STATE FROM STATES WHERE DESCRIPCION='EN_PROCESO' LIMIT 1),
 '2025-08-14 15:30:00', NULL);

INSERT IGNORE INTO DESCRIPTION_ORDER
(ID_DESCRIPTION_ORDER, ID_PRODUCT, ID_ORDER, PESO, PRESENTACION)
VALUES
(12, 10, 11, 50.00, 25.00);

-- =========================================================
-- 7) Entregas del pedido (cabecera + líneas)
--    Si no mandamos UNIT_PRICE, se toma de CUSTOMER_PRODUCT_PRICES
--    según la FECHA de la entrega.
-- =========================================================
-- Entrega #10 del pedido #10 (sin factura)
INSERT IGNORE INTO ORDER_DELIVERY
(ID_ORDER_DELIVERY, ID_ORDER, ID_FACTURA, FECHA, CREATED_BY)
VALUES
(10, 10, NULL, '2025-08-16 10:00:00', NULL);

-- Líneas de entrega para las líneas del pedido #10
-- NOTA: dejamos UNIT_PRICE en NULL para que use el precio vigente (por tu lógica de backend),
-- pero si tu inserción requiere el precio aquí, puedes rellenar UNIT_PRICE = 12.50 / 9.80.
INSERT IGNORE INTO DESCRIPTION_DELIVERY
(ID_DESCRIPTION_DELIVERY, ID_ORDER_DELIVERY, ID_DESCRIPTION_ORDER, PESO, DESCRIPCION, UNIT_PRICE, CURRENCY)
VALUES
(10, 10, 10, 120.50, 'Lote A', NULL, 'PEN'),
(11, 10, 11,  80.00, 'Lote B', NULL, 'PEN');

-- =========================================================
-- 8) Pagos del pedido
-- =========================================================
INSERT IGNORE INTO PAYMENTS
(ID_PAYMENT, ID_ORDER, PAYMENT_DATE, AMOUNT, METHOD, REFERENCE, OBSERVACION, CURRENCY, CREATED_BY)
VALUES
(10, 10, '2025-08-18', 1000.00, 'TRANSFERENCIA', 'OP-000123', 'Adelanto de factura', 'PEN', NULL);

-- =========================================================
-- 9) Stock terminado (si deseas un registro inicial manual)
--    (No es obligatorio para probar compras/entregas/pagos)
-- =========================================================
INSERT IGNORE INTO STOCK_FINISHED_PRODUCT
(ID_PRO, ID_PRODUCT, ID_SPACE, PESO, FECHA)
VALUES
(10, 10, 11, 50.00, '2025-08-10 08:00:00');

-- =========================================================
-- 10) Gastos de ejemplo (requiere EXPENSE_TYPES ya poblado)
-- =========================================================
INSERT IGNORE INTO EXPENSES
(ID_EXPENSE, ID_EXPENSE_TYPE, EXPENSE_DATE, DESCRIPTION, SUPPLIER_NAME,
 INVOICE_NUMBER, PAYMENT_METHOD, AMOUNT_NET, TAX_AMOUNT, CURRENCY, ID_ORDER, CREATED_BY)
VALUES
(
  10,
  (SELECT ID_EXPENSE_TYPE FROM EXPENSE_TYPES WHERE NAME='Materia Prima' LIMIT 1),
  '2025-08-10',
  'Compra de insumos varios',
  'ProveePeru SAC',
  'F001-10',
  'TRANSFERENCIA',
  925.00,
  166.50,
  'PEN',
  10,   -- relacionamos el gasto con el pedido #10 (opcional)
  NULL
);

-- =========================================================
-- 11) (Opcional) Verificaciones rápidas
-- =========================================================

-- Movimientos de stock generados por la compra #10 (trigger)
-- Debes ver 2 movimientos (uno por ítem de compra)
-- SELECT * FROM STOCK_MOVEMENTS_PRIMARY WHERE SOURCE_PURCHASE = 10;

-- Totales "financieros" entregados del pedido 10 (SUBTOTAL sumado)
-- SELECT SUM(dd.SUBTOTAL) FROM ORDER_DELIVERY od
-- JOIN DESCRIPTION_DELIVERY dd ON dd.ID_ORDER_DELIVERY = od.ID_ORDER_DELIVERY
-- WHERE od.ID_ORDER = 10;

-- Total pagado del pedido 10
-- SELECT SUM(AMOUNT) FROM PAYMENTS WHERE ID_ORDER = 10;

-- Progreso por peso del pedido 10
-- SELECT
--   (SELECT IFNULL(SUM(PESO),0) FROM DESCRIPTION_DELIVERY dd
--    JOIN ORDER_DELIVERY od ON od.ID_ORDER_DELIVERY=dd.ID_ORDER_DELIVERY
--    WHERE od.ID_ORDER=10) AS peso_entregado,
--   (SELECT IFNULL(SUM(PESO),0) FROM DESCRIPTION_ORDER WHERE ID_ORDER=10) AS peso_pedido;
