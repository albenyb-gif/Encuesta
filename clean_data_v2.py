import json

input_path = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
output_path = r'c:\gemini\ENCUESTA\encuestas_LIMPIEZA_PULSANTE.json'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. Eliminar duplicados EXACTOS (mismo contenido de 'datos')
unique_data = []
seen_data = set()

for r in data:
    # Convertimos los datos a un string para poder compararlos
    content_str = json.dumps(r['datos'], sort_keys=True)
    if content_str not in seen_data:
        unique_data.append(r)
        seen_data.add(content_str)

# 2. De los únicos, ¿cuántos tienen coordenadas?
con_gps = []
sin_gps = []

for r in unique_data:
    q2 = r.get('datos', {}).get('q2')
    if isinstance(q2, dict) and q2.get('lat') is not None:
        con_gps.append(r)
    else:
        sin_gps.append(r)

print(f"Resultados de Limpieza Exacta:")
print(f"- Total analizados: {len(data)}")
print(f"- Registros únicos encontrados: {len(unique_data)}")
print(f"- Con Coordenadas: {len(con_gps)}")
print(f"- Sin Coordenadas: {len(sin_gps)}")

# Según tu pedido: ¿Quieres dejar SOLO los que tienen coordenadas o TODOS los únicos?
# Dejaré SOLO los con GPS como pediste, pero guardaré los otros por si acaso en otro archivo.
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(con_gps, f, indent=2, ensure_ascii=False)

print(f"Archivo Final (Solo con GPS) guardado en: {output_path}")
