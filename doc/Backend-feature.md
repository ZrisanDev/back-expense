# ⚙️ Backend – Expense Evidence Tracker (NestJS + LocalStack)

---

## 🔐 Autenticación y Autorización

- Registro de usuarios con email y contraseña (hash con bcrypt)
- Login con generación de JWT (access token de corta vida + refresh token)
- Endpoint de refresh token para renovación silenciosa
- Logout con invalidación de refresh token (blacklist en BD o Redis)
- Guard global de autenticación JWT en todas las rutas protegidas
- Guard de roles para separar permisos (usuario / admin)
- Middleware de rate limiting en endpoints de auth

---

## 📁 Gestión de Archivos (S3 / LocalStack)

- Generación de presigned URL (PUT) para subida directa desde el cliente
- Presigned URL con expiración configurable (ej. 5 minutos)
- Validación del tipo MIME permitido al generar la URL (jpg, png, pdf)
- Validación de tamaño máximo de archivo
- Generación de presigned URL (GET) para acceso seguro al comprobante
- Endpoint para eliminar archivo de S3 al eliminar un gasto
- Configuración de cliente AWS SDK con endpoint apuntando a LocalStack en desarrollo
- Variables de entorno para bucket, región y endpoint de LocalStack

---

## 🔔 Eventos S3 → Lambda (LocalStack)

- Configuración de S3 Event Notification hacia una función Lambda local
- Lambda suscrita al evento `s3:ObjectCreated:*` en el bucket de comprobantes
- Parsing del evento S3 para extraer bucket name y object key
- Manejo de errores si el evento no tiene el formato esperado

---

## 🧾 Procesamiento OCR (Lambda)

- Descarga del archivo desde S3 a memoria dentro de la Lambda
- Detección automática del tipo de archivo (imagen vs PDF)
- Extracción de texto para imágenes con Tesseract.js o AWS Textract (mock en LocalStack)
- Extracción de texto para PDFs con pdf-parse o pdfjs-dist
- Limpieza básica del texto extraído (eliminar caracteres nulos, normalizar espacios)
- Manejo de error si el archivo está corrupto o vacío → estado `FAILED`
- Output: `raw_text` como string plano

---

## 🧠 Procesamiento con IA (Lambda)

- Envío del `raw_text` al modelo de IA (Claude API u OpenAI)
- Prompt estructurado con instrucciones de extracción y formato JSON esperado
- Parseo del JSON devuelto por el modelo
- Validación de campos obligatorios: `amount`, `currency`, `date`, `vendor`, `category`, `confidence`
- Validación de tipos de datos (number, string, fecha ISO)
- Si el JSON es inválido o incompleto → estado `NEEDS_REVIEW`
- Si el parseo falla completamente → estado `FAILED`
- Soporte para reintentos del llamado a IA (máximo configurable, ej. 3 intentos)

---

## 💾 Persistencia (PostgreSQL con TypeORM / Prisma)

- Entidad `User`: id, email, password_hash, name, default_currency, confidence_threshold, created_at
- Entidad `Expense`: id, user_id, amount, currency, category, vendor, date, status, created_at, updated_at
- Entidad `File`: id, expense_id, s3_key, file_url, file_type, uploaded_at
- Entidad `ProcessingResult`: id, expense_id, raw_text, structured_json, confidence, processed_at
- Entidad `ExpenseStatusHistory`: id, expense_id, from_status, to_status, changed_at, reason
- Relaciones: User → Expense (1:N), Expense → File (1:1), Expense → ProcessingResult (1:1)
- Migraciones de base de datos versionadas
- Seed inicial de categorías por defecto

---

## 🔄 Comunicación Lambda → Backend

- Endpoint interno en NestJS para recibir resultados del procesamiento (POST `/internal/processing-result`)
- Autenticación del endpoint interno con API key compartida (variable de entorno)
- Actualización del estado del `Expense` según el resultado
- Creación del registro `ProcessingResult` con `raw_text` y `structured_json`
- Creación del registro `ExpenseStatusHistory` al cambiar de estado
- Transacción de base de datos para garantizar consistencia entre tablas

---

## 📋 API REST – Gastos

- `POST /expenses/upload-url` → Generar presigned URL y crear `Expense` en estado `UPLOADED`
- `GET /expenses` → Listar gastos del usuario autenticado (paginado)
- `GET /expenses/:id` → Detalle de un gasto con su archivo y resultado de procesamiento
- `PATCH /expenses/:id` → Edición manual de campos (solo si está en `NEEDS_REVIEW` o `PROCESSED`)
- `DELETE /expenses/:id` → Eliminar gasto y archivo asociado en S3
- `POST /expenses/:id/reprocess` → Reencolar el archivo para reprocesamiento
- `PATCH /expenses/:id/approve` → Aprobar un gasto en `NEEDS_REVIEW` sin editar campos
- Filtros disponibles en listado: `status`, `category`, `date_from`, `date_to`, `vendor`
- Paginación con `page` y `limit` (límite máximo configurable)
- Ordenamiento por `date`, `amount`, `created_at`

---

## 📊 API REST – Estadísticas

- `GET /stats/summary` → Total gastado en el mes actual, cantidad de comprobantes por estado
- `GET /stats/by-category` → Agrupación de gastos por categoría en un rango de fechas
- `GET /stats/monthly` → Gasto mensual histórico agrupado por mes
- `GET /stats/export/csv` → Exportación de gastos a CSV con filtros opcionales

---

## 🗂️ API REST – Categorías

- `GET /categories` → Listar categorías disponibles del usuario
- `POST /categories` → Crear categoría personalizada
- `PATCH /categories/:id` → Editar categoría
- `DELETE /categories/:id` → Eliminar categoría (con validación si está en uso)

---

## 🔁 Reprocesamiento

- Endpoint `POST /expenses/:id/reprocess` que dispara manualmente la Lambda para un `s3_key` dado
- Registro del reprocesamiento en `ExpenseStatusHistory`
- Bloqueo de reprocesamiento si ya está en estado `PROCESSING`
- Limpieza del `ProcessingResult` anterior antes del nuevo procesamiento

---

## ⚠️ Validación y Manejo de Errores

- DTOs con `class-validator` para todos los endpoints
- Pipe global de validación (`ValidationPipe`) con `whitelist: true` y `forbidNonWhitelisted: true`
- Filtro global de excepciones con respuesta estandarizada `{ statusCode, message, error }`
- Manejo de errores de S3 (acceso denegado, archivo no encontrado)
- Manejo de errores de base de datos (unique constraint, foreign key)
- Logging de errores en Lambda con nivel de severidad diferenciado

---

## 🔍 Auditoría y Trazabilidad

- Guardado del `raw_text` original en `ProcessingResult`
- Guardado del `structured_json` generado por IA en `ProcessingResult`
- Historial de cambios de estado en `ExpenseStatusHistory`
- Logs estructurados en JSON con timestamp, nivel, contexto y mensaje (usando Logger de NestJS o Pino)
- Trazabilidad del `file_key` en S3 vinculado al `expense_id`

---

## 🔁 Detección de Duplicados

- Al crear un nuevo `Expense`, verificar si existe otro del mismo `user_id` con mismo `amount` + `date` + `vendor`
- Retornar advertencia en la respuesta si se detecta posible duplicado (sin bloquear la subida)
- Flag `is_duplicate_suspect` en la entidad `Expense`

---

## 🔔 Notificaciones en Tiempo Real

- Endpoint SSE (Server-Sent Events) `GET /expenses/:id/status-stream` para escuchar cambios de estado
- Emisión de evento cuando la Lambda actualiza el estado de un `Expense`
- Alternativa: integración con WebSockets usando `@nestjs/websockets`

---

## ⏱️ Reintentos Automáticos y Jobs Programados

- Job periódico (cron) para detectar gastos atascados en `PROCESSING` por más de X minutos
- Reencolar automáticamente o marcar como `FAILED` según política configurable
- Job para limpiar presigned URLs expiradas o archivos huérfanos en S3

---

## 🔧 Infraestructura y Configuración

- Módulo `ConfigModule` con validación de variables de entorno al arranque (Joi o `@nestjs/config`)
- Variables requeridas: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `S3_BUCKET`, `S3_ENDPOINT`, `INTERNAL_API_KEY`, `AI_API_KEY`, `CONFIDENCE_THRESHOLD`
- Docker Compose con servicios: NestJS, PostgreSQL, LocalStack, Lambda (via LocalStack)
- LocalStack configurado con servicios: `s3`, `lambda`, `sqs` (opcional para cola de reintentos)
- Script de inicialización de LocalStack: creación de bucket, función Lambda, y configuración de S3 event notification
- Swagger / OpenAPI habilitado en entorno de desarrollo con `@nestjs/swagger`
- Health check endpoint `GET /health` con verificación de conexión a BD y S3

---

## 🛡️ Seguridad

- Helmet para headers HTTP seguros
- CORS configurado con lista blanca de orígenes
- Variables sensibles nunca expuestas en respuestas de la API
- Acceso a archivos S3 únicamente mediante presigned URLs con expiración
- Roles de IAM simulados en LocalStack para la función Lambda (sin credenciales hardcodeadas)
- Sanitización de inputs para prevenir SQL injection (garantizado por ORM, pero validado en DTOs)

---
