import json
import os

DATA_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
BACKUP_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json.bak'

# Common Mojibake mappings (UTF-8 bytes read as Latin-1)
REPLACEMENTS = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã\xad': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã\x81': 'Á',
    'Ã\x89': 'É',
    'Ã\x8d': 'Í',
    'Ã\x93': 'Ó',
    'Ã\x9a': 'Ú',
    'Ã\x91': 'Ñ',
    'Ã¼': 'ü',
    'Â¿': '¿',
    'Â¡': '¡',
    'â\x80\x93': '–', # Dash
    'â\x80\x94': '—', # Long dash
    'â\x80\x9c': '“',
    'â\x80\x9d': '”',
    'â\x80\x98': '‘',
    'â\x80\x99': '’',
    # Adding some others seen in logs if necessary
    'mǭs': 'más',
    'Josǭ': 'José',
    'Barrio o Compaa': 'Barrio o Compañía',
    'Compaa': 'Compañía'
}

def fix_string(s):
    if not isinstance(s, str): return s
    new_s = s
    for old, new in REPLACEMENTS.items():
        new_s = new_s.replace(old, new)
    return new_s

def fix_recursive(obj):
    if isinstance(obj, dict):
        return {fix_string(k): fix_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [fix_recursive(x) for x in obj]
    else:
        return fix_string(obj)

def repair():
    if not os.path.exists(DATA_FILE):
        print("Archivo no encontrado")
        return

    # Backup
    with open(DATA_FILE, 'rb') as f:
        content = f.read()
    with open(BACKUP_FILE, 'wb') as f:
        f.write(content)

    try:
        # Intentar cargar el JSON
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        repaired_data = fix_recursive(data)

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(repaired_data, f, indent=2, ensure_ascii=False)
            
        print("Reparación de encoding completada con éxito.")
        
    except Exception as e:
        print(f"Error durante la reparación: {e}")

if __name__ == "__main__":
    repair()
