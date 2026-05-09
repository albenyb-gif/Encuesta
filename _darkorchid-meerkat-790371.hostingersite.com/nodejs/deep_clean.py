import json

input_path = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
output_json = r'c:\gemini\ENCUESTA\TOTAL_RESCATE_LIMPIO_DEFINITIVO.json'
output_csv = r'c:\gemini\ENCUESTA\REPORTE_FINAL_PULIDO.csv'

with open(input_path, 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Iniciando limpieza profunda sobre {len(raw_data)} registros.")

final_list = []
seen_fingerprints = set()

# Campos para comparar (si todo esto es igual, es la misma encuesta)
# q1:partido, q3:barrio, q4...q8: respuestas
for r in raw_data:
    d = r.get('datos', {})
    q2 = d.get('q2', {})
    
    if not (isinstance(q2, dict) and q2.get('lat')):
        continue # Ignorar sin GPS
    
    # Creamos una huella basada en las respuestas REALES, no en el tiempo
    # Redondeamos lat/lng a 6 decimales para evitar micro-diferencias
    lat = round(float(q2.get('lat')), 6)
    lng = round(float(q2.get('lng')), 6)
    
    # Huella: Respuestas + Ubicacion
    fingerprint = (
        d.get('q1'),
        d.get('q3'),
        d.get('q4'),
        d.get('q5'),
        d.get('q6'),
        d.get('q7'),
        d.get('q8'),
        lat,
        lng
    )
    
    if fingerprint not in seen_fingerprints:
        final_list.append(r)
        seen_fingerprints.add(fingerprint)

print(f"Registros únicos reales encontrados: {len(final_list)}")

# Guardar JSON definitivo
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(final_list, f, indent=2, ensure_ascii=False)

# Guardar CSV Pulido
headers = ['Nro', 'Fecha_Hora', 'Encuestador', 'Latitud', 'Longitud', 'Barrio', 'Partido', 'Preg_4', 'Preg_5', 'Voto_Int', 'Voto_Con', 'Preg_8']
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
        str(d.get('q4', '')),
        str(d.get('q5', '')),
        str(d.get('q6', '')),
        str(d.get('q7', '')),
        str(d.get('q8', '')).replace('\n', ' ').replace(';', ',')
    ]
    csv_rows.append(";".join(row))

with open(output_csv, 'w', encoding='utf-16') as f:
    f.write('\ufeff' + ";".join(headers) + "\n" + "\n".join(csv_rows))

print(f"Reporte pulido generado: {output_csv}")
