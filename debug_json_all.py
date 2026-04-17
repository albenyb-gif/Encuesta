import json
import os

SOURCE_DIR = r'C:\gemini\ENCUESTA\copia encuesta'
files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.json')]

for filename in files:
    path = os.path.join(SOURCE_DIR, filename)
    print(f"\n--- {filename} ---")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            t_data = type(data).__name__
            print(f"Tipo del dato raíz: {t_data}")
            if isinstance(data, list):
                if len(data) > 0:
                    print(f"Tipo del primer elemento: {type(data[0]).__name__}")
                print(f"Número de elementos: {len(data)}")
            elif isinstance(data, str):
                print(f"Contenido (primeros 50): {data[:50]}...")
    except Exception as e:
        print(f"Error: {e}")
