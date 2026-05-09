import json
import csv
import os

def extract_surveys(directory, target_date="2026-04-12", output_csv=None):
    seen_fingerprints = set()
    records = []
    
    files_to_scan = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.json'):
                files_to_scan.append(os.path.join(root, file))
                
    for file_path in files_to_scan:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, list): continue
                for entry in data:
                    timestamp = entry.get('timestamp', '')
                    if target_date in timestamp:
                        datos = entry.get('datos', {})
                        loc = datos.get('q2', {})
                        lat = str(round(float(loc.get('lat', 0)), 6)) if isinstance(loc, dict) else str(loc)
                        lng = str(round(float(loc.get('lng', 0)), 6)) if isinstance(loc, dict) else ""
                        
                        resp_content = str({k:v for k,v in datos.items() if k not in ['q2', 'timestamp', 'time']})
                        fingerprint = f"{lat}|{lng}|{resp_content}"
                        
                        if fingerprint not in seen_fingerprints:
                            seen_fingerprints.add(fingerprint)
                            records.append(entry)
        except Exception:
            continue

    if not records:
        print("No se encontraron registros.")
        # Intentaremos sacar por lo menos del CSV dañado si falla lo de buscar en JSONs
        return records

    all_keys = set()
    for entry in records:
        all_keys.update(entry.get('datos', {}).keys())
    
    columns = ['ID_Original', 'Fecha_Hora', 'Encuestador', 'Latitud', 'Longitud']
    questions = sorted([k for k in all_keys if k not in ['q2', 'timestamp', 'id', 'usuario_nombre']])
    columns.extend(questions)

    with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(columns)
        
        for entry in records:
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
                try:
                    if ',' in str(loc):
                        lat_val, lng_val = str(loc).split(',', 1)
                        row.append(lat_val.strip())
                        row.append(lng_val.strip())
                    else:
                        row.append(str(loc))
                        row.append('')
                except Exception:
                    row.append(str(loc))
                    row.append('')
                
            for q in questions:
                val = datos.get(q, '')
                if isinstance(val, list): val = ", ".join([str(v) for v in val])
                row.append(val)
                
            writer.writerow(row)

    print(f"Total extraido y separado: {len(records)}")
    return records

extract_surveys(r'c:\gemini\ENCUESTA', output_csv=r'c:\gemini\ENCUESTA\REPORTE_12_ABRIL_SEPARADO.csv')
