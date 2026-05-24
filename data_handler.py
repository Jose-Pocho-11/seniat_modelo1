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
            
            # El usuario indicó que los datos empiezan en la fila 6 (skiprows=5) y no tienen encabezado.
            # Asignamos manualmente los nombres de las columnas que nos proporcionó.
            column_names = [
                "Código Forma", "Forma", "Código Dependencia", "Dependencia", 
                "Código Banco", "Banco", "Tipo de Documento", "Impuesto", 
                "RIF", "Razón Social", "Período", "Número de Documento", 
                "RIF.1", "Monto", "Fechas de Recaudación"
            ]
            
            if filename.endswith('.csv'):
                df = pd.read_csv(file_obj, skiprows=4, header=None, names=column_names)
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_obj, skiprows=4, header=None, names=column_names)
            else:
                continue
                
            # Limpiar nombres de columnas convirtiéndolos a string (evita errores con columnas vacías leídas como NaN/float)
            df.columns = df.columns.astype(str).str.strip()
            
            # Manejar el caso de que haya múltiples columnas "RIF" 
            # Pandas normalmente renombra duplicados a "RIF", "RIF.1", etc.
            # No necesitamos hacer nada especial si usamos el primer RIF.
            
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
        
        with open('debug_log2.txt', 'w', encoding='utf-8') as f:
            f.write("Primeros 2 registros a enviar al navegador:\n")
            f.write(str(data[:2]) + "\n")
        
        return {"data": data}, 200
        
    except Exception as e:
        return {"error": f"Error al procesar los archivos: {str(e)}"}, 500
