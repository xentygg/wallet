#!/usr/bin/env bash
# Instalador de Don Gato para un servidor Ubuntu 24.04 nuevo (DigitalOcean).
# Uso, como root en la consola del servidor:
#   curl -fsSL https://raw.githubusercontent.com/xentygg/wallet/claude/crear-algo-ganar-dinero-njrn13/deploy/instalar.sh | bash
# Se puede volver a correr sin problema: actualiza el código y conserva la base de datos y la contraseña.
set -euo pipefail

DOMINIO="quinieladongato.com"
REPO="https://github.com/xentygg/wallet.git"
RAMA="claude/crear-algo-ganar-dinero-njrn13"
APP=/opt/dongato
DATOS=/var/lib/dongato
ENVF=/etc/dongato.env

paso() { echo; echo "==> $*"; }
[ "$(id -u)" -eq 0 ] || { echo "Corre este instalador como root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

paso "1/7 Actualizando el sistema e instalando herramientas"
apt-get update -y
apt-get install -y curl git ufw sqlite3 gnupg debian-keyring debian-archive-keyring apt-transport-https ca-certificates

paso "2/7 Instalando Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

paso "3/7 Instalando Caddy (servidor web con candado https automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

paso "4/7 Descargando la página de Don Gato"
id dongato >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin dongato
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --depth 1 origin "$RAMA"
  git -C "$APP" reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$RAMA" "$REPO" "$APP"
fi
mkdir -p "$DATOS/respaldos"
chown -R dongato:dongato "$DATOS"
chmod 750 "$DATOS"

paso "5/7 Configuración y contraseña del panel"
NUEVA_CLAVE=""
if [ ! -f "$ENVF" ]; then
  NUEVA_CLAVE="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)"
  cat > "$ENVF" <<EOF
ADMIN_PASSWORD=$NUEVA_CLAVE
DB_PATH=$DATOS/dongato.db
PORT=3000
NODE_ENV=production
EOF
fi
chown root:dongato "$ENVF"
chmod 640 "$ENVF"

cat > /etc/systemd/system/dongato.service <<EOF
[Unit]
Description=Don Gato (quiniela y trivia)
After=network.target

[Service]
User=dongato
Group=dongato
WorkingDirectory=$APP
EnvironmentFile=$ENVF
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning server/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATOS

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMINIO {
	encode gzip
	reverse_proxy 127.0.0.1:3000
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Frame-Options "DENY"
		-Server
	}
}

www.$DOMINIO {
	redir https://$DOMINIO{uri} permanent
}
EOF

# Respaldo diario de la base de datos (se guardan 30 días)
cat > /etc/cron.daily/dongato-respaldo <<EOF
#!/bin/sh
[ -f $DATOS/dongato.db ] || exit 0
sqlite3 $DATOS/dongato.db ".backup '$DATOS/respaldos/dongato-\$(date +%F).db'"
chown dongato:dongato $DATOS/respaldos/*.db
find $DATOS/respaldos -name 'dongato-*.db' -mtime +30 -delete
EOF
chmod 755 /etc/cron.daily/dongato-respaldo

paso "6/7 Firewall: solo SSH, http y https"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

paso "7/7 Encendiendo todo"
systemctl daemon-reload
systemctl enable dongato >/dev/null 2>&1
systemctl restart dongato
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo "La página responde dentro del servidor. ✅"
else echo "⚠️  La página no respondió. Revisa con: journalctl -u dongato -n 50"; fi

echo
echo "============================================================"
echo "  ¡Listo! Tu página: https://$DOMINIO"
echo "  Panel del administrador: https://$DOMINIO/admin"
if [ -n "$NUEVA_CLAVE" ]; then
  echo
  echo "  CONTRASEÑA DEL PANEL:  $NUEVA_CLAVE"
  echo "  Cópiala y guárdala en un lugar seguro. No se vuelve a mostrar."
  echo "  (Si la pierdes: cat $ENVF)"
fi
echo
echo "  El candado https tarda 1 o 2 minutos la primera vez,"
echo "  y solo funciona si el dominio ya apunta a este servidor."
echo "============================================================"
