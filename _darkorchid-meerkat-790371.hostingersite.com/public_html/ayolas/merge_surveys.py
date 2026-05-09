import csv
import os
import re

DATA_DIR = r'c:\gemini\ENCUESTA'
OUTPUT_FILE = os.path.join(DATA_DIR, 'RESUMEN_TOTAL_ENCUESTAS.csv')

def normalize_coord(val):
    if not val: return None
    # Cambiar coma por punto si es separador decimal (e.g., -27,5 -> -27.5)
    # Detectar si hay coma y tratarla como decimal solo si parece un numero
    new_val = val.replace(',', '.')
    try:
        return round(float(new_val), 6)
    except:
        return None

def detect_delimiter(file_path):
    with open(file_path, 'r', encoding='latin-1') as f:
        first_line = f.readline()
        if ';' in first_line: return ';'
        if ',' in first_line: return ','
    return ';'

def get_mapped_value(row, header, patterns):
    for i, h in enumerate(header):
        for p in patterns:
            if re.search(p, h, re.IGNORECASE):
                return row[i] if i < len(row) else ''
    return ''

def process():
    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv') and '_COORDENADAS' not in f and 'RESUMEN_TOTAL' not in f]
    print(f"Archivos encontrados: {len(files)}")
    
    # Master records: key is (lat, lng)
    master_records = {}
    
    # Unified Header
    # Fecha;Encuestador;Latitud;Longitud;Barrio;Partido;Origen_Archivo
    
    pattern_map = {
        'timestamp': [r'timestamp', r'fecha'],
        'researcher': [r'encuestador', r'usuario_nombre'],
        'neighborhood': [r'barrio', r'q3'],
        'party': [r'partido', r'q1', r'afinidad'],
        'loc_full': [r'ubicaci.*encuesta$'], # Case where lat/lng is in one col
        'lat': [r'latitud', r'lat$', r'encuesta \(lat\)'],
        'lng': [r'longitud', r'lng$', r'encuesta \(lng\)']
    }

    for filename in files:
        path = os.path.join(DATA_DIR, filename)
        delim = detect_delimiter(path)
        print(f"Procesando {filename} (Delim: '{delim}')...")
        
        try:
            with open(path, 'r', encoding='latin-1') as f:
                reader = csv.reader(f, delimiter=delim)
                header = next(reader)
                
                for row in reader:
                    if not any(row): continue
                    
                    # Extract fields
                    ts = get_mapped_value(row, header, pattern_map['timestamp'])
                    res = get_mapped_value(row, header, pattern_map['researcher'])
                    barrio = get_mapped_value(row, header, pattern_map['neighborhood'])
                    partido = get_mapped_value(row, header, pattern_map['party'])
                    
                    lat_val = None
                    lng_val = None
                    
                    # Try separate columns first
                    lat_raw = get_mapped_value(row, header, pattern_map['lat'])
                    lng_raw = get_mapped_value(row, header, pattern_map['lng'])
                    
                    if lat_raw and lng_raw:
                        lat_val = normalize_coord(lat_raw)
                        lng_val = normalize_coord(lng_raw)
                    else:
                        # Try combined column
                        combined = get_mapped_value(row, header, pattern_map['loc_full'])
                        if ',' in combined:
                            parts = combined.split(',')
                            if len(parts) >= 2:
                                lat_val = normalize_coord(parts[0])
                                lng_val = normalize_coord(parts[1])

                    if lat_val is not None and lng_val is not None:
                        coord_key = (lat_val, lng_val)
                        if coord_key not in master_records:
                            master_records[coord_key] = [ts, res, lat_val, lng_val, barrio, partido, filename]
        except Exception as e:
            print(f"Error en {filename}: {e}")

    # Write output
    output_header = ['Fecha', 'Encuestador', 'Latitud', 'Longitud', 'Barrio', 'Partido', 'Fuente']
    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(output_header)
        writer.writerows(master_records.values())

    print(f"\nCOMPLETADO:")
    print(f"- Registros únicos guardados: {len(master_records)}")
    print(f"- Archivo generado: {OUTPUT_FILE}")

if __name__ == "__main__":
    process()
