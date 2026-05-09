import json
import os

SOURCE_DIR = r'C:\gemini\ENCUESTA\copia encuesta'
files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.json')]

for filename in files:
    path = os.path.join(SOURCE_DIR, filename)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                problematic = [i for i, item in enumerate(data) if not isinstance(item, dict)]
                if problematic:
                    print(f"--- {filename} ---")
                    print(f"Elementos no-dict encontrados en indices: {problematic}")
                    print(f"Ejemplo: {data[problematic[0]]}")
            else:
                print(f"--- {filename} --- RAÍZ NO ES LISTA ({type(data).__name__})")
    except Exception as e:
        print(f"--- {filename} --- ERROR: {e}")
