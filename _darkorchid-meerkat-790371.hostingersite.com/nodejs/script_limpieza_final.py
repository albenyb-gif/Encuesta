import json
import os

def clean_survey_data(input_file, output_file):
    if not os.path.exists(input_file):
        print(f"Error: No se encuentra {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    seen = set()
    cleaned_data = []
    
    for entry in data:
        datos = entry.get('datos', {})
        if not datos: continue
        
        # 1. Huella GPS Blindada (Maneja diccionarios, strings o vacíos)
        loc = datos.get('q2', {})
        lat, lng = "0", "0"
        
        if isinstance(loc, dict):
            try:
                lat = str(round(float(loc.get('lat', 0)), 6)) if loc.get('lat') else "0"
                lng = str(round(float(loc.get('lng', 0)), 6)) if loc.get('lng') else "0"
            except (ValueError, TypeError):
                lat, lng = "0", "0"
        elif isinstance(loc, (str, int, float)):
            # Si q2 es un texto o número directo, lo usamos como parte de la huella
            lat = str(loc)
            lng = "FIXED"

        # 2. Huella de Respuestas (Ignoramos tiempos)
        respuestas = {k: v for k, v in datos.items() if k not in ['q2', 'timestamp', 'time']}
        
        resp_items = []
        for k in sorted(respuestas.keys()):
            val = respuestas[k]
            if isinstance(val, list):
                val = "|".join(sorted([str(v).strip() for v in val]))
            elif val is None:
                val = "null"
            else:
                val = str(val).strip()
            resp_items.append(f"{k}:{val}")
            
        fingerprint = f"GPS:{lat},{lng}|DATA:{'#'.join(resp_items)}"
        
        if fingerprint not in seen:
            seen.add(fingerprint)
            cleaned_data.append(entry)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, indent=2, ensure_ascii=False)

    print(f"--- PROCESO DE LIMPIEZA FINALIZADO CON ÉXITO ---")
    print(f"Originales procesados: {len(data)}")
    print(f"Únicos rescatados: {len(cleaned_data)}")
    print(f"Basura eliminada: {len(data) - len(cleaned_data)}")
    print(f"Archivo generado: {output_file}")

input_path = r'c:\gemini\ENCUESTA\copia encuesta\encuestas.json'
output_path = r'c:\gemini\ENCUESTA\ENCUESTAS_LIMPIAS_ABRIL.json'
clean_survey_data(input_path, output_path)
