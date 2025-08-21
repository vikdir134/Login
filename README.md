Se llama auth porque es la abreviatura de authentication (autenticación) — aunque a veces también puede abarcar authorization (autorización).

En tu caso, el archivo auth.routes.js y la ruta base /api/auth/... se usan para todas las operaciones relacionadas con el inicio de sesión y creación de cuenta.
Por qué /api/auth es buena práctica

Organización: Mantiene todo lo relacionado con autenticación en un mismo endpoint base.

Claridad: Cualquiera que vea la API sabe que /api/auth/... maneja login, logout, registro, renovación de tokens, etc.

Escalabilidad: Si más adelante agregas /logout, /refresh-token, /forgot-password, todas irán dentro de /api/auth.


