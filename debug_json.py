import json
import os

SOURCE_DIR = r'C:\gemini\ENCUESTA\copia encuesta'
files = ['encuestas.json', 'encuestas2.json', 'ENCUESTAS_LIMPIAS_ABRIL.json']

for filename in files:
    path = os.path.join(SOURCE_DIR, filename)
    print(f"\nAnalizando {filename}...")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                types = {}
                for item in data:
                    t = type(item).__name__
                    types[t] = types.get(t, 0) + 1
                print(f"Tipos encontrados: {types}")
                if types.get('str'):
                    # Mostrar ejemplo de string
                    for item in data:
                        if isinstance(item, str):
                            print(f"Ejemplo de string: {item[:100]}...")
                            break
            else:
                print(f"No es una lista, es {type(data).__name__}")
    except Exception as e:
        print(f"Error: {e}")
