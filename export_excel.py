import json
import csv
import os

def json_to_csv_excel(input_json, output_csv):
    if not os.path.exists(input_json):
        print(f"Error: No se encuentra {input_json}")
        return

    with open(input_json, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not data:
        print("El archivo está vacío.")
        return

    # 1. Identificar todas las columnas posibles
    all_keys = set()
    for entry in data:
        all_keys.update(entry.get('datos', {}).keys())
    
    # Ordenar las columnas (ID, Fecha, Encuestador primero)
    columns = ['id', 'timestamp', 'usuario_nombre']
    # Añadimos las preguntas (q1, q2, etc.) ordenadas
    questions = sorted([k for k in all_keys if k not in ['q2', 'timestamp', 'id', 'usuario_nombre']])
    
    # q2 es especial (coordenadas)
    columns.extend(['Latitud', 'Longitud'])
    columns.extend(questions)

    # 2. Escribir CSV con BOM para que Excel lo reconozca en español (UTF-8 con BOM)
    with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';') # Punto y coma para Excel en español
        
        # Escribir encabezados
        writer.writerow(columns)
        
        for entry in data:
            row = []
            datos = entry.get('datos', {})
            
            # Datos básicos
            row.append(entry.get('id', ''))
            row.append(entry.get('timestamp', ''))
            row.append(entry.get('usuario_nombre', ''))
            
            # GPS
            loc = datos.get('q2', {})
            if isinstance(loc, dict):
                row.append(loc.get('lat', ''))
                row.append(loc.get('lng', ''))
            else:
                row.append(str(loc))
                row.append('')
                
            # Preguntas
            for q in questions:
                val = datos.get(q, '')
                if isinstance(val, list):
                    val = ", ".join([str(v) for v in val])
                row.append(val)
                
            writer.writerow(row)

    print(f"--- REPORTE CSV GENERADO ---")
    print(f"Registros exportados: {len(data)}")
    print(f"Archivo guardado en: {output_csv}")

json_path = r'c:\gemini\ENCUESTA\ENCUESTAS_LIMPIAS_ABRIL.json'
csv_path = r'c:\gemini\ENCUESTA\REPORTE_LIMPIO_ABRIL.csv'
json_to_csv_excel(json_path, csv_path)
