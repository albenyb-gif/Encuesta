import csv
import os

input_file = r'c:\gemini\ENCUESTA\reporte_senior_2026-04-16.csv'
output_file = r'c:\gemini\ENCUESTA\reporte_senior_2026-04-16_PARA_CARGAR.csv'

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
    with open(input_file, mode='r', encoding='latin-1') as f:
        reader = csv.reader(f, delimiter=';')
        rows = list(reader)

    if not rows:
        print("El archivo está vacío.")
        exit(1)

    new_rows = [target_headers]

    for row in rows[1:]:
        if len(row) < 13: continue
        
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
