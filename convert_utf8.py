import json
import os

DATA_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'

def convert_to_utf8():
    print(f"Abriendo {DATA_FILE} como Latin-1...")
    # Leer como latin-1 para preservar los bytes originales como caracteres
    with open(DATA_FILE, 'r', encoding='latin-1') as f:
        content = f.read()
    
    # Intentar cargar para validar
    try:
        data = json.loads(content)
        print("JSON cargado exitosamente como Latin-1.")
    except Exception as e:
        print(f"Error cargando JSON: {e}")
        return

    # Guardar como UTF-8 real
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Base de datos convertida a UTF-8 real.")

if __name__ == "__main__":
    convert_to_utf8()
