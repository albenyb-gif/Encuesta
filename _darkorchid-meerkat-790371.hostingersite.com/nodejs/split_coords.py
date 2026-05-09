import csv
import os

files_to_process = [
    '11 y santiago.csv',
    'santiago.csv'
]

def process_file(filename):
    input_file = os.path.join(r'c:\gemini\ENCUESTA', filename)
    name, ext = os.path.splitext(filename)
    output_file = os.path.join(r'c:\gemini\ENCUESTA', f"{name}_COORDENADAS{ext}")

    try:
        with open(input_file, mode='r', encoding='latin-1') as f:
            reader = csv.reader(f, delimiter=';')
            rows = list(reader)

        if not rows:
            print(f"El archivo {filename} está vacío.")
            return

        header = rows[0]
        # Encontrar el índice de la columna de ubicación
        # "Ubicaci\u00f3n de la Encuesta"
        target_idx = -1
        for i, h in enumerate(header):
            if 'Ubicaci' in h and 'Encuesta' in h:
                target_idx = i
                break

        if target_idx == -1:
            print(f"No se encontró la columna de ubicación en {filename}.")
            return

        # Crear nuevo header
        new_header = header[:target_idx] + ['Latitud', 'Longitud'] + header[target_idx+1:]
        new_rows = [new_header]

        for row in rows[1:]:
            if len(row) > target_idx:
                coord_str = row[target_idx]
                if ',' in coord_str:
                    lat, lng = coord_str.split(',', 1)
                    new_row = row[:target_idx] + [lat.strip(), lng.strip()] + row[target_idx+1:]
                else:
                    # Caso por si no tiene coma o está vacío
                    new_row = row[:target_idx] + [coord_str, ''] + row[target_idx+1:]
                new_rows.append(new_row)
            else:
                new_rows.append(row)

        with open(output_file, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f, delimiter=';')
            writer.writerows(new_rows)

        print(f"Archivo procesado con éxito: {output_file}")

    except Exception as e:
        print(f"Error procesando {filename}: {e}")

for f in files_to_process:
    process_file(f)
