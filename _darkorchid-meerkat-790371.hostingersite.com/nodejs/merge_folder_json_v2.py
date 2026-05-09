import json
import os
import csv

SOURCE_DIR = r'C:\gemini\ENCUESTA\copia encuesta'
OUTPUT_JSON = r'C:\gemini\ENCUESTA\CONSOLIDADO_TOTAL_JSON_COPIA.json'
OUTPUT_CSV = r'C:\gemini\ENCUESTA\CARGAR_COPIA_PARA_SISTEMA.csv'

# Labels for the 9-question CSV format
TARGET_HEADERS = [
    'Timestamp',
    'Datos Demográficos (Seleccione múltiples)',
    '¿A qué partido pertenece o tiene afinidad?',
    'Ubicación de la Encuesta',
    'Barrio o Compañía',
    'Calificación: Gestión del Intendente Municipal',
    'Calificación: Gestión del Presidente de la República',
    'Pre-candidatos a Intendente Municipal',
    'Pre-candidatos a Concejal Municipal',
    '¿Qué servicio público debe mejorar la municipalidad?'
]

def normalize_val(val):
    if val is None: return ""
    if isinstance(val, list): return ", ".join(map(str, val))
    return str(val).strip()

def fix_and_get_datos(item):
    """Garantiza que el item sea un dict y extrae los datos."""
    if isinstance(item, str):
        try:
            item = json.loads(item)
        except:
            return None
    
    if not isinstance(item, dict):
        return None
        
    # El objeto real suele estar en 'datos', si no está, usamos el raiz
    return item.get('datos', item)

def process():
    files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.json')]
    print(f"Analizando {len(files)} archivos en {SOURCE_DIR}...")
    
    master_dict = {} # Key: (lat, lng)
    duplicates_count = 0
    errors_count = 0
    
    for filename in files:
        path = os.path.join(SOURCE_DIR, filename)
        print(f"  -> {filename}...")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if not isinstance(data, list):
                    # Algunos archivos pueden ser un solo objeto en vez de lista
                    data = [data]
                
                for raw_item in data:
                    item_datos = fix_and_get_datos(raw_item)
                    if not item_datos:
                        errors_count += 1
                        continue
                    
                    # Extraer coordenadas
                    q2 = item_datos.get('q2', {})
                    if not isinstance(q2, dict): q2 = {} # Fallback por si q2 no es objeto
                    
                    lat = q2.get('lat')
                    lng = q2.get('lng')
                    
                    if lat is not None and lng is not None:
                        try:
                            # Normalizar a 6 decimales para la huella única
                            lat_f = round(float(lat), 6)
                            lng_f = round(float(lng), 6)
                            key = (lat_f, lng_f)
                            
                            if key not in master_dict:
                                # Guardamos el objeto original para el JSON
                                master_dict[key] = {
                                    "source_file": filename,
                                    "norm_lat": lat_f,
                                    "norm_lng": lng_f,
                                    "full_record": raw_item
                                }
                            else:
                                duplicates_count += 1
                        except:
                            errors_count += 1
                    else:
                        errors_count += 1
        except Exception as e:
            print(f"    ERROR CRÍTICO en {filename}: {e}")

    # 1. Exportar JSON Consolidado
    final_list = [v["full_record"] for v in master_dict.values()]
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)
    
    # 2. Exportar CSV para el Sistema (Formato 9 preguntas)
    csv_rows = [TARGET_HEADERS]
    for key, val in master_dict.items():
        original = val["full_record"]
        datos = fix_and_get_datos(original)
        
        # q2 en CSV se espera como "lat,lng"
        lat_v, lng_v = key
        coords = f"{lat_v},{lng_v}"
        
        row = [
            original.get('timestamp', datos.get('timestamp', '')),
            normalize_val(datos.get('q_demo')),
            normalize_val(datos.get('q1')),
            coords,
            normalize_val(datos.get('q3')),
            normalize_val(datos.get('q4')),
            normalize_val(datos.get('q5')),
            normalize_val(datos.get('q6')),
            normalize_val(datos.get('q7')),
            normalize_val(datos.get('q8'))
        ]
        csv_rows.append(row)
        
    with open(OUTPUT_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerows(csv_rows)

    print(f"\nCOMPLETADO:")
    print(f"- Archivos procesados: {len(files)}")
    print(f"- Registros únicos encontrados: {len(master_dict)}")
    print(f"- Duplicados por coordenadas omitidos: {duplicates_count}")
    print(f"- Registros inválidos o incompletos: {errors_count}")
    print(f"- JSON Generado: {OUTPUT_JSON}")
    print(f"- CSV Generado: {OUTPUT_CSV}")

if __name__ == "__main__":
    process()
