import json

# Esquema de etiquetas para las columnas
schema_labels = {
    "q_demo": "Datos Demográficos",
    "q1": "Partido o Afinidad",
    "q2": "Ubicación GPS",
    "q3": "Barrio o Compañía",
    "q4": "Gestión Intendente",
    "q5": "Gestión Presidente",
    "q6": "Voto Intendente",
    "q7": "Voto Concejal",
    "q8": "Mejora Servicio Público"
}

input_path = r'c:\gemini\ENCUESTA\encuestas_LIMPIEZA_PULSANTE.json'
output_path = r'c:\gemini\ENCUESTA\REPORTE_FINAL_308_LIMPIO.csv'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Encabezados
headers = ["Fecha y Hora", "Encuestador", "Latitud", "Longitud"]
question_ids = ["q_demo", "q1", "q3", "q4", "q5", "q6", "q7", "q8"]
headers += [schema_labels.get(qid, qid) for qid in question_ids]

rows = []
for r in data:
    d = r.get('datos', {})
    
    # Manejo de coordenadas
    q2 = d.get('q2', {})
    lat = q2.get('lat', '')
    lng = q2.get('lng', '')
    
    row = [
        d.get('timestamp', r.get('timestamp', '')),
        r.get('usuario_nombre', 'Desconocido'),
        str(lat).replace('.', ','), # Excel en español usa coma decimal
        str(lng).replace('.', ','),
    ]
    
    for qid in question_ids:
        val = d.get(qid, '')
        if isinstance(val, list):
            val = ", ".join(val)
        row.append(str(val).replace(';', ',')) # Evitar romper el CSV
        
    rows.append(";".join(row))

# Escribir con BOM para que Excel detecte acentos automáticamente
with open(output_path, 'w', encoding='utf-16') as f:
    f.write('\ufeff') # Byte Order Mark para Excel
    f.write(";".join(headers) + "\n")
    f.write("\n".join(rows))

print(f"Reporte generado con éxito: {output_path}")
print(f"Total registros: {len(rows)}")
