Se llama auth porque es la abreviatura de authentication (autenticación) — aunque a veces también puede abarcar authorization (autorización).

En tu caso, el archivo auth.routes.js y la ruta base /api/auth/... se usan para todas las operaciones relacionadas con el inicio de sesión y creación de cuenta.
Por qué /api/auth es buena práctica

Organización: Mantiene todo lo relacionado con autenticación en un mismo endpoint base.

Claridad: Cualquiera que vea la API sabe que /api/auth/... maneja login, logout, registro, renovación de tokens, etc.

Escalabilidad: Si más adelante agregas /logout, /refresh-token, /forgot-password, todas irán dentro de /api/auth.



sql
CREATE DATABASE IF NOT EXISTS auth_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE auth_demo;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SHOW DATABASES;
USE auth_demo;
SHOW TABLES;
DESCRIBE users;
CREATE USER IF NOT EXISTS 'auth_user'@'localhost' IDENTIFIED BY '3360160@Am';
GRANT ALL PRIVILEGES ON auth_demo.* TO 'auth_user'@'localhost';
FLUSH PRIVILEGES;