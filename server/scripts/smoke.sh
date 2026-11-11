#!/usr/bin/env bash
# Prueba de humo contra el Worker local (npm run dev). Los correos son SINTÉTICOS.
# Uso: bash scripts/smoke.sh [http://127.0.0.1:8787]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"

reg=$(curl -sf -X POST "$BASE/v1/register")
token=$(node -e 'console.log(JSON.parse(process.argv[1]).token)' "$reg")
address=$(node -e 'console.log(JSON.parse(process.argv[1]).address)' "$reg")
echo "Registrado: $address"

send() { # $1 = from, $2 = archivo con el correo crudo
  curl -sf -X POST "$BASE/cdn-cgi/local/email?from=$1&to=$address" --data-binary @"$2" -o /dev/null -w '%{http_code}\n'
}

tmp=$(mktemp -d)
cat > "$tmp/compra.eml" <<EOF
From: Alertas Banco <alertas@banco.example>
To: usuario@gmail.com
Subject: =?UTF-8?Q?Notificaci=C3=B3n_de_compra?=
Message-ID: <compra-1@banco.example>
Date: Tue, 10 Nov 2026 21:30:00 -0600
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

<html><body><p>Se realiz=C3=B3 una compra con tu tarjeta con terminaci=C3=B3n =
4321.</p><table><tr><td>Comercio:</td><td>CAFETERIA EJEMPLO</td></tr><tr><td>Monto:</td><td>=
&#36;1,250.00 MXN</td></tr></table></body></html>
EOF
cat > "$tmp/gmail.eml" <<EOF
From: Gmail Team <forwarding-noreply@google.com>
To: $address
Subject: (#987654321) Gmail Forwarding Confirmation
Message-ID: <conf-1@google.com>
Date: Tue, 10 Nov 2026 20:00:00 -0600
Content-Type: text/plain; charset=UTF-8

Confirm here: https://mail-settings.google.com/mail/vf-xyz
EOF

echo "Compra: $(send alertas@banco.example "$tmp/compra.eml")"
echo "Repetida: $(send alertas@banco.example "$tmp/compra.eml")"
echo "Confirmación Gmail: $(send forwarding-noreply@google.com "$tmp/gmail.eml")"

inbox=$(curl -sf "$BASE/v1/inbox" -H "Authorization: Bearer $token")
echo "$inbox"
node -e '
const r = JSON.parse(process.argv[1]);
const ok = r.items.length === 1 && r.items[0].amount === 125000 && r.items[0].merchant === "CAFETERIA EJEMPLO"
  && r.items[0].cardLast4 === "4321" && r.items[0].receivedAt === "2026-11-11T03:30:00.000Z"
  && r.forwardingConfirmation?.code === "987654321";
if (!ok) { console.error("FALLO: bandeja inesperada"); process.exit(1); }
' "$inbox"

id=$(node -e 'console.log(JSON.parse(process.argv[1]).items[0].id)' "$inbox")
curl -sf -X POST "$BASE/v1/inbox/ack" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "{\"ids\":[\"$id\"]}" -o /dev/null
left=$(curl -sf "$BASE/v1/inbox" -H "Authorization: Bearer $token" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).items.length))')
[ "$left" = 0 ] || { echo "FALLO: el ack no borró el pendiente"; exit 1; }

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/inbox" -H 'Authorization: Bearer malo')
[ "$code" = 401 ] || { echo "FALLO: token inválido devolvió $code"; exit 1; }

desconocido=$(curl -s -X POST "$BASE/cdn-cgi/local/email?from=a@b.example&to=nadie@example.com" --data-binary @"$tmp/compra.eml")
echo "Dirección desconocida: $desconocido"
echo "TODO OK"
