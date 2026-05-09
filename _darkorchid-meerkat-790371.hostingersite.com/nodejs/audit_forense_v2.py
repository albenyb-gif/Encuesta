import json
import os
from collections import defaultdict

def detailed_audit(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"--- REPORTE DE AUDITORÍA DETALLADA (Hostinger Copy) ---")
    print(f"Total de registros en el archivo: {len(data)}")

    groups = defaultdict(list)
    
    for entry in data:
        datos = entry.get('datos', {})
        
        # 1. Coordenadas (Suelo de referencia)
        loc = datos.get('q2', {})
        lat = str(round(float(loc.get('lat', 0)), 6))
        lng = str(round(float(loc.get('lng', 0)), 6))
        
        # 2. Respuestas (Ignoramos el timestamp que causa el falso 'único')
        # Filtramos q2 (ya la tenemos) y cualquier campo de tiempo
        respuestas = {k: v for k, v in datos.items() if k not in ['q2', 'timestamp', 'time']}
        
        # Normalizar respuestas (ordenar keys y limpiar strings)
        resp_key = []
        for k in sorted(respuestas.keys()):
            val = respuestas[k]
            if isinstance(val, list):
                val = "|".join(sorted([str(v).strip() for v in val]))
            else:
                val = str(val).strip()
            resp_key.append(f"{k}:{val}")
            
        fingerprint = f"GPS:{lat},{lng} | DATA:{'#'.join(resp_key)}"
        groups[fingerprint].append(entry)

    # Estadísticas
    unique_records = len(groups)
    
    counts = defaultdict(int)
    for g in groups.values():
        counts[len(g)] += 1

    print(f"\nResumen de Duplicación:")
    print(f"- Registros Reales (Únicos): {unique_records}")
    print(f"- Registros Totales: {len(data)}")
    print(f"- Exceso de basura (duplicados a borrar): {len(data) - unique_records}")
    
    print(f"\nDistribución:")
    for num, freq in sorted(counts.items()):
        if num == 1:
            print(f"  * {freq} encuestas son legítimas (aparecen solo 1 vez)")
        else:
            print(f"  * {freq} encuestas están repetidas {num} veces (total {freq*num} filas)")

    # Mostrar sospechosos de triplicados
    triplicates = [g for g in groups.values() if len(g) >= 3]
    if triplicates:
        print(f"\nALERTA: Se encontraron {len(triplicates)} casos de TRIPLICADOS o más.")
        # Ejemplo del primero
        sample = triplicates[0][0]
        print(f"Ejemplo de triplicado en {sample['datos'].get('q3', 'GPS')}:")
        print(f"IDs: {[e.get('id') for e in triplicates[0]]}")

detailed_audit(r'c:\gemini\ENCUESTA\copia encuesta\encuestas.json')
