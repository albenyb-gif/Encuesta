import json
import os

input_path = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
output_path = r'c:\gemini\ENCUESTA\encuestas_LIMPIEZA_COORDINADAS.json'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f'Encuestas totales en archivo: {len(data)}')

# Agrupar por contenido único
unique_records = {}

for r in data:
    d = r.get('datos', {})
    ts = d.get('timestamp')
    if not ts: continue
    
    # Verificar si tiene coordenadas
    q2 = d.get('q2')
    has_coords = isinstance(q2, dict) and q2.get('lat') is not None
    
    # Clave de identidad basada en el timestamp de captura (ms) y barrio
    content_key = f"{ts}_{d.get('q3', '')}"
    
    if content_key not in unique_records:
        unique_records[content_key] = r
    else:
        # Si es duplicado, preferir la versión que tenga coordenadas
        old_r = unique_records[content_key]
        old_q2 = old_r.get('datos', {}).get('q2')
        old_has_coords = isinstance(old_q2, dict) and old_q2.get('lat') is not None
        
        if has_coords and not old_has_coords:
            unique_records[content_key] = r

# Filtrar: solo las que tienen coordenadas
final_list = []
for r in unique_records.values():
    q2 = r.get('datos', {}).get('q2')
    if isinstance(q2, dict) and q2.get('lat') is not None:
        final_list.append(r)

print(f'Encuestas únicas (sin duplicados): {len(unique_records)}')
print(f'Encuestas finales con GPS: {len(final_list)}')

# Guardar
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(final_list, f, indent=2, ensure_ascii=False)

print(f'Archivo limpio generado: {output_path}')
