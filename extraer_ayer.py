import json
import csv
import os
from datetime import datetime

def extract_yesterday_surveys(directory, target_date="2026-04-13", output_csv=None):
    seen_fingerprints = set()
    yesterday_records = []
    
    # Archivos a escanear (buscamos en todos los JSON)
    files_to_scan = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.json'):
                files_to_scan.append(os.path.join(root, file))
    
    print(f"Escaneando {len(files_to_scan)} archivos en busca de datos del {target_date}...")
    
    for file_path in files_to_scan:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, list):
                    continue
                
                for entry in data:
                    timestamp = entry.get('timestamp', '')
                    # Comprobamos si la fecha coincide (2026-04-13)
                    if target_date in timestamp:
                        datos = entry.get('datos', {})
                        
                        # Crear huella para no repetir si está en varios archivos
                        loc = datos.get('q2', {})
                        lat = str(round(float(loc.get('lat', 0)), 6)) if isinstance(loc, dict) else str(loc)
                        lng = str(round(float(loc.get('lng', 0)), 6)) if isinstance(loc, dict) else ""
                        
                        # Fingerprint simple: GPS + Respuestas
                        resp_content = str({k:v for k,v in datos.items() if k not in ['q2', 'timestamp', 'time']})
                        fingerprint = f"{lat}|{lng}|{resp_content}"
                        
                        if fingerprint not in seen_fingerprints:
                            seen_fingerprints.add(fingerprint)
                            yesterday_records.append(entry)
        except Exception as e:
            # Ignorar archivos que no sean encuestas válidas
            continue

    if not yesterday_records:
        print(f"No se encontraron registros para la fecha {target_date}.")
        return

    # Preparar CSV
    all_keys = set()
    for entry in yesterday_records:
        all_keys.update(entry.get('datos', {}).keys())
    
    columns = ['ID_Original', 'Fecha_Hora', 'Encuestador', 'Latitud', 'Longitud']
    questions = sorted([k for k in all_keys if k not in ['q2', 'timestamp', 'id', 'usuario_nombre']])
    columns.extend(questions)

    with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(columns)
        
        for entry in yesterday_records:
            row = []
            datos = entry.get('datos', {})
            row.append(entry.get('id', ''))
            row.append(entry.get('timestamp', ''))
            row.append(entry.get('usuario_nombre', ''))
            
            loc = datos.get('q2', {})
            if isinstance(loc, dict):
                row.append(loc.get('lat', ''))
                row.append(loc.get('lng', ''))
            else:
                row.append(str(loc))
                row.append('')
                
            for q in questions:
                val = datos.get(q, '')
                if isinstance(val, list): val = ", ".join([str(v) for v in val])
                row.append(val)
                
            writer.writerow(row)

    print(f"--- REPORTE FINALIZADO ---")
    print(f"Total de encuestas encontradas ayer ({target_date}): {len(yesterday_records)}")
    print(f"Archivo guardado en: {output_csv}")

extract_yesterday_surveys(r'c:\gemini\ENCUESTA', output_csv=r'c:\gemini\ENCUESTA\REPORTE_AYER_13_ABRIL.csv')
