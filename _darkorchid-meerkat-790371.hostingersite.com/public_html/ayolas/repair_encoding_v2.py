import json
import os

DATA_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'
BACKUP_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json.fixed.bak'

def try_repair_string(s):
    if not isinstance(s, str): return s
    try:
        # Intento 1: ¿Es UTF-8 interpretado como latin-1?
        # Corrigiendo casos como "JosÃ©" -> "José"
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Si falla, puede que no sea ese el problema, o tenga caracteres mixtos.
        # Fallback a reemplazos manuales comunes si se detectan patrones.
        replacements = {
            '\u0116': 'É', # Ejemplo de lo detectado arriba
            '\u0117': 'é',
            '\u0105': 'á',
            '\u0104': 'Á',
            'mǭs': 'más',
            'Josǭ': 'José',
            'Barrio o Compaa': 'Barrio o Compañía',
            'Compaa': 'Compañía'
        }
        new_s = s
        for old, new in replacements.items():
            new_s = new_s.replace(old, new)
        return new_s

def fix_recursive(obj):
    if isinstance(obj, dict):
        return {fix_recursive(k): fix_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [fix_recursive(x) for x in obj]
    elif isinstance(obj, str):
        return try_repair_string(obj)
    else:
        return obj

def repair():
    print(f"Abriendo {DATA_FILE}...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    repaired_data = fix_recursive(data)
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(repaired_data, f, indent=2, ensure_ascii=False)
    
    print("Base de datos procesada y guardada.")

if __name__ == "__main__":
    repair()
