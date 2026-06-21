import pandas as pd
import io
import re
import sqlite3

def parse_monto_venezuela(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val_str = str(val).strip()
    if not val_str: return 0.0
    
    if ',' in val_str:
        val_str = val_str.replace('.', '').replace(',', '.')
    else:
        if '.' in val_str:
            parts = val_str.split('.')
            # Si el último grupo tiene exactamente 3 dígitos y hay un punto, suele ser separador de miles en Vzla (ej. "15.250")
            if len(parts[-1]) == 3:
                val_str = val_str.replace('.', '')
                
    val_str = re.sub(r'[^0-9.-]', '', val_str)
    try:
        return float(val_str)
    except:
        return 0.0

def process_files(file_list):
    try:
        dataframes = []
        
        for file_obj in file_list:
            filename = file_obj.filename.lower()
            
            # Leemos sin encabezado para buscar la fila de datos dinámicamente
            if filename.endswith('.csv'):
                df = pd.read_csv(file_obj, header=None)
            elif filename.endswith(('.xlsx', '.xls')):
                try:
                    df = pd.read_excel(file_obj, header=None)
                except ValueError:
                    # Fallback for SENIAT files that are actually HTML disguised as .xls
                    try:
                        file_obj.seek(0)
                        # El SENIAT usa windows-1252 o latin1 en la mayoría de los casos
                        try:
                            dfs = pd.read_html(file_obj, header=None, encoding='windows-1252')
                        except ValueError:
                            # Si no funciona con la codificación, intentamos sin especificar
                            file_obj.seek(0)
                            dfs = pd.read_html(file_obj, header=None)
                            
                        if dfs:
                            # SENIAT HTML exports contain multiple <table> elements (headers, layout, then the real data)
                            found_df = None
                            for candidate_df in dfs:
                                # Revisar si los encabezados están ya en df.columns (cuando pd.read_html usa etiquetas <th>)
                                col_str = ' '.join([str(x).lower() for x in candidate_df.columns])
                                if 'forma' in col_str and 'monto' in col_str and 'rif' in col_str:
                                    candidate_df.loc[-1] = candidate_df.columns
                                    candidate_df.index = candidate_df.index + 1
                                    candidate_df = candidate_df.sort_index()
                                    found_df = candidate_df
                                    break
                                
                                # Si no, buscar en las filas de esta tabla
                                found_in_rows = False
                                for i in range(min(30, len(candidate_df))):
                                    row_str = ' '.join([str(x).lower() for x in candidate_df.iloc[i].values if pd.notna(x)])
                                    if 'forma' in row_str and 'monto' in row_str and 'rif' in row_str:
                                        found_df = candidate_df
                                        found_in_rows = True
                                        break
                                if found_in_rows:
                                    break
                                    
                            if found_df is not None:
                                df = found_df
                            else:
                                return {"error": f"El archivo '{filename}' es HTML pero no se encontró la tabla con los datos requeridos (Forma, Monto, RIF)."}, 400
                        else:
                            return {"error": f"El archivo '{filename}' es un HTML pero no contiene tablas de datos."}, 400
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        return {"error": f"Error al leer '{filename}' como HTML: {str(e)}"}, 400
            else:
                continue
                
            if df is None or df.empty:
                return {"error": f"El archivo '{filename}' está vacío o no pudo ser procesado."}, 400

            # Buscar dinámicamente la fila de encabezados (aumentamos el rango de búsqueda a 30 por seguridad)
            header_idx = -1
            
            # Revisar si los encabezados están ya en df.columns (cuando pd.read_html usa etiquetas <th>)
            col_str = ' '.join([str(x).lower() for x in df.columns])
            if 'forma' in col_str and 'monto' in col_str and 'rif' in col_str:
                # Ya lo empujamos en la lectura del HTML si pasó por ahí, pero para read_excel regular:
                df.loc[-1] = df.columns
                df.index = df.index + 1
                df = df.sort_index()
                header_idx = 0
            else:
                for i in range(min(30, len(df))):
                    row_str = ' '.join([str(x).lower() for x in df.iloc[i].values if pd.notna(x)])
                    # Buscar palabras clave típicas de los encabezados de estos reportes
                    if 'forma' in row_str and 'monto' in row_str and 'rif' in row_str:
                        header_idx = i
                        break
                        
            if header_idx != -1:
                # Recortar el dataframe para que empiece en la primera fila de datos reales
                # Encontrar la primera columna que no esté vacía en la fila de encabezados
                header_row = df.iloc[header_idx]
                start_col = 0
                for col_idx, val in enumerate(header_row):
                    if pd.notna(val) and str(val).strip() != "":
                        start_col = col_idx
                        break
                
                # Tomamos los datos desde la fila siguiente y 15 columnas a partir de start_col
                df = df.iloc[header_idx + 1:, start_col:start_col+15].reset_index(drop=True)
            else:
                with open('debug_html_table.txt', 'w', encoding='utf-8') as f:
                    f.write("No se encontraron encabezados. Aquí están las primeras 30 filas parseadas:\n")
                    f.write(df.head(30).to_string())
                return {"error": f"Estructura inválida en el archivo '{filename}'. No se encontraron los encabezados esperados."}, 400
                
            # Asignar nombres de columnas estandarizados para que el frontend no se rompa
            # El frontend espera exactamente estos nombres
            column_names = [
                "Código Forma", "Forma", "Código Dependencia", "Dependencia", 
                "Código Banco", "Banco", "Tipo de Documento", "Impuesto", 
                "RIF", "Razón Social", "Período", "Número de Documento", 
                "RIF.1", "Monto", "Fechas de Recaudación"
            ]
            
            # Validar que el archivo tenga exactamente 15 columnas
            if len(df.columns) == 15:
                df.columns = column_names
            else:
                return {"error": f"Estructura inválida en el archivo '{filename}'. Se esperaban 15 columnas, pero se encontraron {len(df.columns)}."}, 400
            
            with open('debug_log.txt', 'w', encoding='utf-8') as f:
                f.write("Columnas detectadas:\n")
                f.write(str(df.columns.tolist()) + "\n\n")
                if not df.empty:
                    f.write("Primera fila:\n")
                    f.write(str(df.iloc[0].to_dict()) + "\n")
                    
            dataframes.append(df)
            
        if not dataframes:
            return {"error": "No se encontraron archivos válidos o soportados."}, 400
            
        # Unir todos los archivos
        combined_df = pd.concat(dataframes, ignore_index=True)
        
        # Parsear Monto con nuestra función robusta
        if 'Monto' in combined_df.columns:
            combined_df['Monto'] = combined_df['Monto'].apply(parse_monto_venezuela)
        
        # Rellenar valores nulos temporalmente para poder filtrar
        combined_df = combined_df.fillna('')
        
        # Filtrar filas de "Totales" que vienen en el Excel:
        # Una fila válida debe tener números en su RIF o RIF.1
        if 'RIF' in combined_df.columns and 'RIF.1' in combined_df.columns:
            rif_str = combined_df['RIF'].astype(str) + combined_df['RIF.1'].astype(str)
            combined_df = combined_df[rif_str.str.contains(r'\d', regex=True)]
            
        # También eliminar si la primera columna empieza con "Total"
        if 'Código Forma' in combined_df.columns:
            combined_df = combined_df[~combined_df['Código Forma'].astype(str).str.lower().str.contains('total', na=False)]
        
        # Convertir a lista de diccionarios
        data = combined_df.to_dict(orient='records')
        
        # Save to cache file for multi-page persistence
        import json
        with open('data_cache.json', 'w', encoding='utf-8') as f:
            json.dump(data, f)
            
        with open('debug_log2.txt', 'w', encoding='utf-8') as f:
            f.write("Primeros 2 registros a enviar al navegador:\n")
            f.write(str(data[:2]) + "\n")
        
        return {"data": data}, 200
        
    except Exception as e:
        return {"error": f"Error al procesar los archivos: {str(e)}"}, 500

from init_db import DB_PATH

def get_calendar_for_year(anio):
    """
    Retorna el calendario de un año en el formato esperado por el frontend.
    Formato:
    {
        1: { ENE: {0:1, 1:2...}, FEB: {...} ... },
        2: { ENE: {...}, FEB: {...} ... }
    }
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT mes, quincena, terminal_rif, dia_vencimiento FROM calendarios WHERE anio = ?", (anio,))
        rows = cursor.fetchall()
    finally:
        conn.close()
    
    cal = {
        1: {m: {} for m in ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']},
        2: {m: {} for m in ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']}
    }
    
    is_empty = len(rows) == 0
    
    for row in rows:
        mes, quincena, terminal_rif, dia_vencimiento = row
        cal[quincena][mes][terminal_rif] = dia_vencimiento
        
    return cal, is_empty

def save_calendar_days(anio, mes, quincena, dias):
    """
    Guarda los días límite para una quincena y mes específicos.
    dias: list of 10 values (for terminal 0 to 9). Values can be empty string.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        
        for terminal_rif, dia_vencimiento in enumerate(dias):
            if dia_vencimiento == '' or dia_vencimiento is None:
                # Eliminar si existe
                cursor.execute('''
                    DELETE FROM calendarios 
                    WHERE anio = ? AND mes = ? AND quincena = ? AND terminal_rif = ?
                ''', (anio, mes, quincena, terminal_rif))
            else:
                # Insertar o actualizar
                cursor.execute('''
                    INSERT INTO calendarios (anio, mes, quincena, terminal_rif, dia_vencimiento)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(anio, mes, quincena, terminal_rif) DO UPDATE SET dia_vencimiento=excluded.dia_vencimiento
                ''', (anio, mes, quincena, terminal_rif, int(dia_vencimiento)))
                
        conn.commit()
    finally:
        conn.close()

def get_calendar_dpp_for_year(anio):
    """
    Retorna el calendario DPP de un año en el formato esperado por el frontend.
    Formato:
    { ENE: {0:1, 1:2...}, FEB: {...} ... }
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT mes, terminal_rif, dia_vencimiento FROM calendarios_dpp WHERE anio = ?", (anio,))
        rows = cursor.fetchall()
    finally:
        conn.close()
    
    cal = {m: {} for m in ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']}
    is_empty = len(rows) == 0
    
    for row in rows:
        mes, terminal_rif, dia_vencimiento = row
        cal[mes][terminal_rif] = dia_vencimiento
        
    return cal, is_empty

def save_calendar_dpp_days(anio, mes, dias):
    """
    Guarda los días límite para un mes específico en DPP.
    dias: list of 10 values (for terminal 0 to 9). Values can be empty string.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        
        for terminal_rif, dia_vencimiento in enumerate(dias):
            if dia_vencimiento == '' or dia_vencimiento is None:
                # Eliminar si existe
                cursor.execute('''
                    DELETE FROM calendarios_dpp 
                    WHERE anio = ? AND mes = ? AND terminal_rif = ?
                ''', (anio, mes, terminal_rif))
            else:
                # Insertar o actualizar
                cursor.execute('''
                    INSERT INTO calendarios_dpp (anio, mes, terminal_rif, dia_vencimiento)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(anio, mes, terminal_rif) DO UPDATE SET dia_vencimiento=excluded.dia_vencimiento
                ''', (anio, mes, terminal_rif, int(dia_vencimiento)))
                
        conn.commit()
    finally:
        conn.close()

