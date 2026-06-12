import pandas as pd
import io

import re

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
                df = pd.read_excel(file_obj, header=None)
            else:
                continue
                
            # Buscar dinámicamente la fila de encabezados
            header_idx = -1
            for i in range(min(20, len(df))):
                row_str = ' '.join([str(x).lower() for x in df.iloc[i].values if pd.notna(x)])
                # Buscar palabras clave típicas de los encabezados de estos reportes
                if 'forma' in row_str and 'monto' in row_str and 'rif' in row_str:
                    header_idx = i
                    break
                    
            if header_idx != -1:
                # Recortar el dataframe para que empiece en la primera fila de datos reales
                df = df.iloc[header_idx + 1:].reset_index(drop=True)
            else:
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
                return {"error": f"Estructura inválida en el archivo '{filename}'. Se esperaban 15 columnas, pero el archivo tiene {len(df.columns)} columnas."}, 400
            
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
