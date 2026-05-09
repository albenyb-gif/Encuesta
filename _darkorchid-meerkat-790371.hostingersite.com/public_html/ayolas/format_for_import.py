import csv
import os

input_file = r'c:\gemini\ENCUESTA\ENCUESTA TODO.csv'
output_file = r'c:\gemini\ENCUESTA\ENCUESTA_PARA_CARGAR.csv'

# Target labels from app.js DEFAULT_SCHEMA
target_headers = [
    'Timestamp',
    'Datos Demográficos (Seleccione múltiples)',
    '¿A qué partido pertenece o tiene afinidad?',
    'Ubicación de la Encuesta',
    'Barrio o Compañía',
    'Calificación: Gestión del Intendente Municipal',
    'Calificación: Gestión del Presidente de la República',
    'Pre-candidatos a Intendente Municipal',
    'Pre-candidatos a Concejal Municipal',
    '¿Qué servicio público debe mejorar la municipalidad?'
]

try:
    # Try different encodings
    with open(input_file, mode='r', encoding='latin-1') as f:
        reader = csv.reader(f, delimiter=';')
        rows = list(reader)

    if not rows:
        print("El archivo está vacío.")
        exit(1)

    original_header = rows[0]
    
    # Map original column indices to target headers
    # ID;Timestamp;Encuestador;Datos Demogrficos...;A qu partido...;Ubicacin (Lat);Ubicacin (Lng);Barrio...
    
    # We will build the new rows based on the logic:
    # Col 0: Timestamp
    # Rest: Questions matched by label.
    
    new_rows = [target_headers]

    for row in rows[1:]:
        if len(row) < 13: continue
        
        # Mapping:
        # 1: Timestamp
        # 3: Datos Demo
        # 4: Partido
        # 5+6: Lat + Lng
        # 7: Barrio
        # 8: Cal Intendente
        # 9: Cal Presidente
        # 10: Candidates
        # 11: Concejal
        # 12: Mejora
        
        try:
            timestamp = row[1]
            q_demo = row[3]
            q_partido = row[4]
            lat = row[5].replace(',', '.')
            lng = row[6].replace(',', '.')
            coords = f"{lat},{lng}"
            q_barrio = row[7]
            q_int = row[8]
            q_pres = row[9]
            q_cand = row[10]
            q_conc = row[11]
            q_mej = row[12]
            
            new_row = [
                timestamp,
                q_demo,
                q_partido,
                coords,
                q_barrio,
                q_int,
                q_pres,
                q_cand,
                q_conc,
                q_mej
            ]
            new_rows.append(new_row)
        except Exception as e:
            print(f"Saltando fila con error: {e}")

    with open(output_file, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerows(new_rows)

    print(f"Archivo generado con éxito: {output_file}")

except Exception as e:
    print(f"Error procesando el archivo: {e}")
