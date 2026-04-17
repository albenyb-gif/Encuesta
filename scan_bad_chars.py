import json
import os
import re

DATA_FILE = r'c:\gemini\ENCUESTA\encuesta_central_data (1)\encuestas.json'

def find_mojibake(obj, bad_chars):
    if isinstance(obj, str):
        # Look for non-ascii and weird combos
        for char in obj:
            if ord(char) > 127:
                bad_chars.add(char)
        # Look for common patterns
        matches = re.findall(r'Ã.|Â.', obj)
        for m in matches:
            bad_chars.add(m)
    elif isinstance(obj, dict):
        for v in obj.values(): find_mojibake(v, bad_chars)
    elif isinstance(obj, list):
        for x in obj: find_mojibake(x, bad_chars)

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

bad = set()
find_mojibake(data, bad)
print(f"Caracteres detectados: {sorted(list(bad))}")
