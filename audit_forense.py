import json
import os
from collections import defaultdict

def audit_duplicates(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"--- INFORME DE AUDITORÍA FORENSE ---")
    print(f"Total de registros cargados: {len(data)}")

    fingerprints = defaultdict(list)
    
    for i, entry in enumerate(data):
        datos = entry.get('datos', {})
        
        # 1. Extraer Coordenadas
        loc = datos.get('q2', {})
        lat = round(float(loc.get('lat', 0)), 6)
        lng = round(float(loc.get('lng', 0)), 6)
        
        # 2. Extraer Respuestas (limpiar para comparar)
        # Quitamos q2 y timestamp si existe para comparar solo contenido
        respuestas = {k: v for k, v in datos.items() if k not in ['q2', 'timestamp']}
        
        # Serializar respuestas de forma determinista
        resp_str = json.dumps(respuestas, sort_keys=True)
        
        # Crear huella única
        fingerprint = f"{lat}|{lng}|{resp_str}"
        
        fingerprints[fingerprint].append(entry)

    unique_count = len(fingerprints)
    duplicate_groups = [g for g in fingerprints.values() if len(g) > 1]
    total_duplicates = sum(len(g) - 1 for g in duplicate_groups)

    print(f"Registros ÚNICOS (GPS + Respuestas): {unique_count}")
    print(f"Registros DUPLICADOS encontrados: {total_duplicates}")
    print(f"Grupos de duplicación (puntos con más de 1): {len(duplicate_groups)}")

    if duplicate_groups:
        print("\n--- EJEMPLO DE DUPLICADO DETECTADO ---")
        example_group = duplicate_groups[0]
        first = example_group[0]
        print(f"Ubicación: {first['datos'].get('q2', {})}")
        print(f"Contenido: { {k:v for k,v in first['datos'].items() if k != 'q2'} }")
        print(f"IDs encontrados en este grupo: {[e.get('id') for e in example_group]}")
        print(f"Tiempos (timestamps): {[e.get('timestamp') for e in example_group]}")

audit_duplicates(r'c:\gemini\ENCUESTA\copia encuesta\encuestas.json')
