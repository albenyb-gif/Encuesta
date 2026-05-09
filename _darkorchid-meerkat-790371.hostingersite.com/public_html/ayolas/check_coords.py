import json

path = r'c:\gemini\ENCUESTA\encuestas_LIMPIEZA_PULSANTE.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

coords_map = {}
for r in data:
    q2 = r['datos']['q2']
    # Usamos 6 decimales para la comparar (aprox. 10cm de precisión)
    lat = round(q2['lat'], 6)
    lng = round(q2['lng'], 6)
    key = f"{lat},{lng}"
    
    if key not in coords_map:
        coords_map[key] = []
    coords_map[key].append(r)

shared_points = {k: v for k, v in coords_map.items() if len(v) > 1}

print(f"ANÁLISIS DE COORDENADAS:")
print(f"- Total encuestas analizadas: {len(data)}")
print(f"- Puntos geográficos distintos: {len(coords_map)}")
print(f"- Puntos con múltiples encuestas (mismo sitio): {len(shared_points)}")

total_shared = sum(len(v) for v in shared_points.values())
print(f"- Total de encuestas que comparten sitio: {total_shared}")

if shared_points:
    print("\nEjemplos de sitios con más de una encuesta:")
    count = 0
    for k, v in shared_points.items():
        if count >= 3: break
        print(f"\nUbicación: {k}")
        for r in v:
            d = r['datos']
            print(f"  * {r['usuario_nombre']} - {d.get('q3', 'Sin barrio')} - Votaría a: {d.get('q1', 'NS/NR')}")
        count += 1
