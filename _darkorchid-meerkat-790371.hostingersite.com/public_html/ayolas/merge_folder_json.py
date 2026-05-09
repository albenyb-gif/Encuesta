import json
import os
import csv

SOURCE_DIR = r'C:\gemini\ENCUESTA\copia encuesta'
OUTPUT_JSON = r'C:\gemini\ENCUESTA\CONSOLIDADO_COPIA_ENCUESTA.json'
OUTPUT_CSV = r'C:\gemini\ENCUESTA\CARGAR_COPIA_CONSOLIDADA.csv'

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

def process():
    files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.json')]
    print(f"Archivos JSON encontrados: {len(files)}")
    
    unique_surveys = {} # Key: (lat, lng)
    
    for filename in files:
        path = os.path.join(SOURCE_DIR, filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, list): continue
                
                for item in data:
                    # En los JSONs, los datos reales están usualmente en la propiedad 'datos'
                    datos = item.get('datos', item)
                    q2 = datos.get('q2', {})
                    
                    lat = q2.get('lat')
                    lng = q2.get('lng')
                    
                    if lat is not None and lng is not None:
                        # Normalizar a 6 decimales para la huella
                        try:
                            key = (round(float(lat), 6), round(float(lng), 6))
                            if key not in unique_surveys:
                                unique_surveys[key] = item
                        except:
                            continue
        except Exception as e:
            print(f"Error procesando {filename}: {e}")

    # 1. Guardar JSON Consolidado
    consolidated_list = list(unique_surveys.values())
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(consolidated_list, f, indent=2, ensure_ascii=False)
    
    # 2. Guardar CSV (Formato 9 preguntas) para carga directa
    csv_rows = [TARGET_HEADERS]
    for item in consolidated_list:
        datos = item.get('datos', item)
        q2 = datos.get('q2', {})
        coords = f"{q2.get('lat', '')},{q2.get('lng', '')}"
        
        row = [
            item.get('timestamp', datos.get('timestamp', '')),
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

    print(f"\nPROCESO COMPLETADO:")
    print(f"- Encuestas únicas encontradas: {len(consolidated_list)}")
    print(f"- JSON Generado: {OUTPUT_JSON}")
    print(f"- CSV para carga directa: {OUTPUT_CSV}")

if __name__ == "__main__":
    process()
