#!/usr/bin/env bash
# Instalador para un servidor Ubuntu 24.04 (DigitalOcean). Puede tener varias páginas (marcas) en el mismo servidor.
#
# Don Gato (la de siempre), como root en la consola del servidor:
#   curl -fsSL https://raw.githubusercontent.com/xentygg/wallet/claude/crear-algo-ganar-dinero-njrn13/deploy/instalar.sh | bash
#
# Otra página, p. ej. La Quiniela del Lic:
#   curl -fsSL https://raw.githubusercontent.com/xentygg/wallet/claude/crear-algo-ganar-dinero-njrn13/deploy/instalar.sh | INSTANCIA=licenciado DOMINIO=quinieladellic.com bash
#
# Se puede volver a correr sin problema: actualiza el código y conserva bases de datos y contraseñas.
set -euo pipefail

INSTANCIA="${INSTANCIA:-dongato}"
MARCA="${MARCA:-$INSTANCIA}"
REPO="https://github.com/xentygg/wallet.git"
RAMA="claude/crear-algo-ganar-dinero-njrn13"
APP=/opt/dongato                      # el código es el mismo para todas las páginas
DATOS="/var/lib/$INSTANCIA"
ENVF="/etc/$INSTANCIA.env"

paso() { echo; echo "==> $*"; }
[ "$(id -u)" -eq 0 ] || { echo "Corre este instalador como root."; exit 1; }
[[ "$INSTANCIA" =~ ^[a-z0-9-]+$ ]] || { echo "INSTANCIA solo puede tener minúsculas, números y guiones."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

# Dominio y puerto: se recuerdan en el archivo de configuración de cada página
leer() { [ -f "$ENVF" ] && grep -E "^$1=" "$ENVF" | tail -1 | cut -d= -f2- || true; }
DOMINIO="${DOMINIO:-$(leer DOMINIO)}"
[ -z "$DOMINIO" ] && [ "$INSTANCIA" = "dongato" ] && DOMINIO="quinieladongato.com"
[ -n "$DOMINIO" ] || { echo "Falta el dominio. Ejemplo: ... | INSTANCIA=$INSTANCIA DOMINIO=midominio.com bash"; exit 1; }
PUERTO="$(leer PORT)"
if [ -z "$PUERTO" ]; then
  if [ "$INSTANCIA" = "dongato" ]; then PUERTO=3000; else
    PUERTO=3001; while grep -qsE "^PORT=$PUERTO$" /etc/*.env; do PUERTO=$((PUERTO + 1)); done
  fi
fi

paso "1/7 Actualizando el sistema e instalando herramientas"
apt-get update -y
apt-get install -y curl git ufw sqlite3 gnupg debian-keyring debian-archive-keyring apt-transport-https ca-certificates

paso "2/7 Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

paso "3/7 Caddy (servidor web con candado https automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

paso "4/7 Descargando el código"
id dongato >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin dongato
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --depth 1 origin "$RAMA"
  git -C "$APP" reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$RAMA" "$REPO" "$APP"
fi
[ -f "$APP/marcas/$MARCA/marca.json" ] || { echo "No existe la marca '$MARCA' (carpeta marcas/$MARCA)."; exit 1; }
mkdir -p "$DATOS/respaldos"
chown -R dongato:dongato "$DATOS"
chmod 750 "$DATOS"

paso "5/7 Configuración de $INSTANCIA ($DOMINIO, puerto $PUERTO)"
NUEVA_CLAVE=""
if [ ! -f "$ENVF" ]; then
  NUEVA_CLAVE="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)"
  echo "ADMIN_PASSWORD=$NUEVA_CLAVE" > "$ENVF"
fi
poner() { if grep -qE "^$1=" "$ENVF"; then sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi; }
poner DB_PATH "$DATOS/dongato.db"
poner PORT "$PUERTO"
poner NODE_ENV production
poner MARCA "$MARCA"
poner DOMINIO "$DOMINIO"
poner SITIO_URL "https://$DOMINIO"
poner DISCORD_CONFIG_PATH "$DATOS/discord.json"
chown root:dongato "$ENVF"
chmod 640 "$ENVF"

cat > "/etc/systemd/system/$INSTANCIA.service" <<EOF
[Unit]
Description=Quiniela $INSTANCIA ($DOMINIO)
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

# Caddy: un archivo por página en /etc/caddy/sitios/, y el principal solo los importa
mkdir -p /etc/caddy/sitios
sitio() {   # sitio <instancia> <dominio> <puerto>
  cat > "/etc/caddy/sitios/$1.caddy" <<EOF
$2 {
	encode gzip
	reverse_proxy 127.0.0.1:$3
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Frame-Options "DENY"
		-Server
	}
}

www.$2 {
	redir https://$2{uri} permanent
}
EOF
}
sitio "$INSTANCIA" "$DOMINIO" "$PUERTO"
# Si Don Gato ya estaba instalado con el instalador viejo, se conserva su sitio
if [ "$INSTANCIA" != "dongato" ] && [ -f /etc/dongato.env ] && [ ! -f /etc/caddy/sitios/dongato.caddy ]; then
  D=$(grep -E '^DOMINIO=' /etc/dongato.env | cut -d= -f2-); D=${D:-quinieladongato.com}
  P=$(grep -E '^PORT=' /etc/dongato.env | cut -d= -f2-); P=${P:-3000}
  sitio dongato "$D" "$P"
fi
echo "import /etc/caddy/sitios/*.caddy" > /etc/caddy/Caddyfile

# Respaldo diario de la base de datos (se guardan 30 días)
cat > "/etc/cron.daily/$INSTANCIA-respaldo" <<EOF
#!/bin/sh
[ -f $DATOS/dongato.db ] || exit 0
sqlite3 $DATOS/dongato.db ".backup '$DATOS/respaldos/dongato-\$(date +%F).db'"
chown dongato:dongato $DATOS/respaldos/*.db
find $DATOS/respaldos -name 'dongato-*.db' -mtime +30 -delete
EOF
chmod 755 "/etc/cron.daily/$INSTANCIA-respaldo"

paso "6/7 Firewall: solo SSH, http y https"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

paso "7/7 Encendiendo $INSTANCIA"
systemctl daemon-reload
systemctl enable "$INSTANCIA" >/dev/null 2>&1
systemctl restart "$INSTANCIA"
systemctl enable caddy >/dev/null 2>&1
caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || { echo "⚠️  La configuración de Caddy tiene un error:"; caddy validate --config /etc/caddy/Caddyfile; exit 1; }
systemctl restart caddy
sleep 3
if curl -fsS -o /dev/null "http://127.0.0.1:$PUERTO/"; then echo "La página responde dentro del servidor. ✅"
else echo "⚠️  La página no respondió. Revisa con: journalctl -u $INSTANCIA -n 50"; fi

echo
echo "============================================================"
echo "  ¡Listo! Página: https://$DOMINIO"
echo "  Panel del administrador: https://$DOMINIO/admin"
if [ -n "$NUEVA_CLAVE" ]; then
  echo
  echo "  CONTRASEÑA DEL PANEL:  $NUEVA_CLAVE"
  echo "  Cópiala y guárdala en un lugar seguro. No se vuelve a mostrar."
  echo "  (Si la pierdes: grep ADMIN_PASSWORD $ENVF)"
fi
echo
echo "  El candado https tarda 1 o 2 minutos la primera vez,"
echo "  y solo funciona si el dominio ya apunta a este servidor."
echo "============================================================"
