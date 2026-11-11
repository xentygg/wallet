-- Usuarios: solo una dirección de correo y el hash de su clave de acceso.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  -- Último correo de confirmación de reenvío de Gmail (JSON), si lo hay.
  forwarding_confirmation TEXT,
  created_at TEXT NOT NULL
);

-- Movimientos recibidos por correo, pendientes de que la app los descargue.
-- No se guarda el cuerpo del correo; se borran cuando la app los confirma.
CREATE TABLE pending (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  amount INTEGER,
  merchant TEXT,
  card_last4 TEXT,
  kind TEXT NOT NULL,
  parser TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, message_id)
);

CREATE INDEX pending_user ON pending (user_id, received_at);
