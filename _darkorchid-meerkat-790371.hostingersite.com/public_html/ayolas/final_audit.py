import json

input_path = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
output_json = r'c:\gemini\ENCUESTA\TOTAL_RESCATE_GPS_FINAL.json'
output_csv = r'c:\gemini\ENCUESTA\REPORTE_308_LIMPIO_V2.csv'

with open(input_path, 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Auditoría iniciada: {len(raw_data)} registros encontrados.")

# 1. Filtrar solo los que tienen coordenadas reales
con_gps = []
for r in raw_data:
    d = r.get('datos', {})
    q2 = d.get('q2')
    if isinstance(q2, dict) and q2.get('lat') and q2.get('lng'):
        con_gps.append(r)

print(f"Registros con GPS iniciales: {len(con_gps)}")

# 2. Quitar duplicados por contenido de respuestas para no repetir personas
final_list = []
seen_fingerprints = set()

for r in con_gps:
    d = r.get('datos', {})
    # Creamos una 'huella digital' única del contenido
    fingerprint = f"{d.get('timestamp')}_{d.get('q2', {}).get('lat')}_{d.get('q3')}"
    
    if fingerprint not in seen_fingerprints:
        final_list.append(r)
        seen_fingerprints.add(fingerprint)

print(f"Registros únicos finales con GPS: {len(final_list)}")

# 3. Guardar JSON
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(final_list, f, indent=2, ensure_ascii=False)

# 4. Guardar CSV Renumerado (1...N)
headers = ['Nro', 'Fecha_Hora', 'Encuestador', 'Latitud', 'Longitud', 'Barrio', 'Partido', 'Voto_Intendente', 'Voto_Concejal']
csv_rows = []

for i, r in enumerate(final_list, 1):
    d = r.get('datos', {})
    q2 = d.get('q2', {})
    row = [
        str(i),
        str(d.get('timestamp', '')),
        str(r.get('usuario_nombre', 'N/A')),
        str(q2.get('lat')).replace('.', ','),
        str(q2.get('lng')).replace('.', ','),
        str(d.get('q3', '')),
        str(d.get('q1', '')),
        str(d.get('q6', '')),
        str(d.get('q7', ''))
    ]
    csv_rows.append(";".join(row))

with open(output_csv, 'w', encoding='utf-16') as f:
    f.write('\ufeff' + ";".join(headers) + "\n" + "\n".join(csv_rows))

print(f"Archivos finales generados:")
print(f"- {output_json}")
print(f"- {output_csv}")
