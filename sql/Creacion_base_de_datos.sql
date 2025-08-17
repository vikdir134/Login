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
