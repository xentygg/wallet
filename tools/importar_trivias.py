"""Importa las trivias y las frases de Don Gato desde el proyecto de TikTok (claudetrivia).

Uso:  python3 tools/importar_trivias.py RUTA/A/claudetrivia
Genera data/preguntas.js y data/frases.js. Vuélvelo a correr cuando agregues trivias nuevas.
"""
import importlib.util, json, pathlib, sys
import yaml

origen = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../claudetrivia")
destino = pathlib.Path(__file__).resolve().parent.parent / "data"

DEPORTES = {"futbol": "Futbol", "nfl": "NFL", "beisbol": "Béisbol"}
FORMATOS = {"trivia", "pregunta_del_dia", "verdadero_falso", "quien_tiene_mas"}


def num(v):
    return f"{v:,}".replace(",", " ") if isinstance(v, int) else str(v)


preguntas, vistas = [], set()
for f in sorted((origen / "trivias").glob("*.yaml")):
    t = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    formato = t.get("formato", "trivia")
    if formato not in FORMATOS:
        continue
    deporte = DEPORTES.get(t.get("deporte", "futbol"), "Deportes")
    for q in t.get("preguntas", []):
        try:
            if formato == "verdadero_falso":
                texto = "¿Verdadero o falso? " + str(q["afirmacion"])
                opciones = ["Verdadero", "Falso"]
                correcta = 0 if str(q["respuesta"]).lower().startswith("v") else 1
                dato = q.get("dato", "")
            elif formato == "quien_tiene_mas":
                a, b = q["a"], q["b"]
                if a["valor"] == b["valor"]:
                    continue
                texto = str(q["pregunta"])
                opciones = [str(a["nombre"]), str(b["nombre"])]
                correcta = 0 if a["valor"] > b["valor"] else 1
                u = q.get("unidad", "")
                dato = f"{a['nombre']}: {num(a['valor'])} {u} · {b['nombre']}: {num(b['valor'])} {u}".strip()
            else:
                texto = str(q["pregunta"])
                opciones = [str(o) for o in q["opciones"]]
                correcta = opciones.index(str(q["respuesta"]))
                dato = q.get("dato", "")
        except (KeyError, ValueError, TypeError) as e:
            print(f"  omitida en {f.name}: {e}")
            continue
        if texto in vistas:
            continue
        vistas.add(texto)
        preguntas.append({"p": texto, "o": opciones, "correcta": correcta, "dato": str(dato or ""),
                          "dificultad": q.get("dificultad", ""), "deporte": deporte})

# Frases de Don Gato, tal cual están en personalidad.py (se omiten las que hablan del video)
spec = importlib.util.spec_from_file_location("personalidad", origen / "personalidad.py")
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
web = lambda s: not any(x in s.lower() for x in ("video", "segundo", "comentario", "sígueme", "sigue a"))
frases = {
    "facil": [s for s in P.REACCION_FACIL if web(s)],
    "neutra": [s for s in P.REACCION_NEUTRA if web(s)],
    "dificil": [s for s in P.REACCION_DIFICIL if web(s)],
    "entradas": [{"grande": g.replace("{s}", "deportes"), "letrero": l} for g, l, _ in P.ENTRADAS
                 if web(g + l)],
    "despedidas": [{"titulo": " ".join(t), "letrero": l} for t, l, _ in P.DESPEDIDAS if web(" ".join(t) + l)],
}

cab = "// Generado por tools/importar_trivias.py desde el proyecto de TikTok. No editar a mano.\n"
(destino / "preguntas.js").write_text(cab + "window.PREGUNTAS = " + json.dumps(preguntas, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
(destino / "frases.js").write_text(cab + "window.FRASES = " + json.dumps(frases, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(f"{len(preguntas)} preguntas y {sum(len(v) for v in frases.values())} frases importadas.")
