from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from data_handler import process_files
import sqlite3
from init_db import init_db, DB_PATH

app = Flask(__name__)
app.secret_key = 'seniat_super_secret_key_123'

# Comprobar/Inicializar base de datos y administrador al iniciar la app
init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
@login_required
def index():
    return render_template('index.html', current_user=session.get('user_nombre'))

@app.route('/metricas')
@login_required
def metricas():
    return render_template('metricas.html', current_user=session.get('user_nombre'))

@app.route('/directorio')
@login_required
def directorio():
    return render_template('directorio.html', current_user=session.get('user_nombre'))

@app.route('/historial')
@login_required
def historial():
    return render_template('historial.html', current_user=session.get('user_nombre'))

@app.route('/api/contribuyentes', methods=['GET'])
@login_required
def get_contribuyentes():
    query = request.args.get('q', '')
    dependencia = request.args.getlist('dependencia')
    impuesto = request.args.getlist('impuesto')
    banco = request.args.getlist('banco')
    tipo_documento = request.args.getlist('tipo_documento')
    monto_min = request.args.get('monto_min', '')
    monto_max = request.args.get('monto_max', '')
    fecha_desde = request.args.get('fecha_desde', '')
    fecha_hasta = request.args.get('fecha_hasta', '')
    terminal_rif = request.args.getlist('terminal_rif')

    conn = get_db_connection()
    is_admin = session.get('correo') == 'admin@seniat.gob.ve'
    user_id = session.get('user_id')
    
    base_query = '''
        SELECT 
            MAX(r.id) as "Lote de Entrada",
            r.codigo_control as "Código Forma",
            r.codigo_control as "Forma",
            d.nombre_dependencia as "Código Dependencia",
            d.nombre_dependencia as "Dependencia",
            b.codigo_banco as "Código Banco",
            b.nombre_banco as "Banco",
            td.nombre_documento as "Tipo de Documento",
            ti.nombre_impuesto as "Impuesto",
            r.rif as "RIF Retenedor",
            r.razon_social as "Razón Social",
            r.periodo as "Periodo",
            r.numero_documento as "Número de Documento",
            r.rif as "RIF Contribuyente",
            r.monto as "Monto",
            r.fecha_recaudacion as "Fecha de Recaudación"
        FROM recaudaciones r
        JOIN dependencias d ON r.dependencia_id = d.id
        JOIN bancos b ON r.banco_id = b.id
        JOIN tipos_documento td ON r.tipo_documento_id = td.id
        JOIN tipos_impuesto ti ON r.impuesto_id = ti.id
    '''
    
    if not is_admin:
        base_query += ' JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ?'
        params = [user_id]
    else:
        base_query += ' WHERE 1=1'
        params = []
        
    if query:
        search = f"%{query}%"
        base_query += ' AND (r.rif LIKE ? OR r.razon_social LIKE ?)'
        params.extend([search, search])
        
    if dependencia:
        placeholders = ','.join('?' for _ in dependencia)
        base_query += f' AND d.nombre_dependencia IN ({placeholders})'
        params.extend(dependencia)
    if impuesto:
        placeholders = ','.join('?' for _ in impuesto)
        base_query += f' AND ti.nombre_impuesto IN ({placeholders})'
        params.extend(impuesto)
    if banco:
        placeholders = ','.join('?' for _ in banco)
        base_query += f' AND b.nombre_banco IN ({placeholders})'
        params.extend(banco)
    if tipo_documento:
        placeholders = ','.join('?' for _ in tipo_documento)
        base_query += f' AND td.nombre_documento IN ({placeholders})'
        params.extend(tipo_documento)
    if monto_min:
        try:
            base_query += ' AND r.monto >= ?'
            params.append(float(monto_min))
        except: pass
    if monto_max:
        try:
            base_query += ' AND r.monto <= ?'
            params.append(float(monto_max))
        except: pass
    if fecha_desde:
        base_query += ' AND r.fecha_recaudacion >= ?'
        params.append(fecha_desde)
    if fecha_hasta:
        base_query += ' AND r.fecha_recaudacion <= ?'
        params.append(fecha_hasta)
    if terminal_rif:
        conditions = []
        for t in terminal_rif:
            conditions.append('r.rif LIKE ?')
            params.append(f"%{t}")
        base_query += ' AND (' + ' OR '.join(conditions) + ')'

    base_query += '''
        GROUP BY 
            r.dependencia_id, r.codigo_control, r.banco_id, r.tipo_documento_id, 
            r.impuesto_id, r.rif, r.razon_social, r.periodo, r.numero_documento, 
            r.monto, r.fecha_recaudacion
        LIMIT 100
    '''
    
    contribuyentes = conn.execute(base_query, params).fetchall()
    conn.close()
    
    result = [dict(row) for row in contribuyentes]
    return jsonify(result), 200

@app.route('/api/filtros_opciones', methods=['GET'])
@login_required
def get_filtros_opciones():
    conn = get_db_connection()
    is_admin = session.get('correo') == 'admin@seniat.gob.ve'
    user_id = session.get('user_id')
    
    if is_admin:
        dependencias = [r['nombre'] for r in conn.execute('SELECT DISTINCT nombre_dependencia as nombre FROM dependencias ORDER BY nombre').fetchall()]
        impuestos = [r['nombre'] for r in conn.execute('SELECT DISTINCT nombre_impuesto as nombre FROM tipos_impuesto ORDER BY nombre').fetchall()]
        bancos = [r['nombre'] for r in conn.execute('SELECT DISTINCT nombre_banco as nombre FROM bancos ORDER BY nombre').fetchall()]
        documentos = [r['nombre'] for r in conn.execute('SELECT DISTINCT nombre_documento as nombre FROM tipos_documento ORDER BY nombre').fetchall()]
    else:
        query_dep = 'SELECT DISTINCT d.nombre_dependencia as nombre FROM dependencias d JOIN recaudaciones r ON r.dependencia_id = d.id JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ? ORDER BY nombre'
        dependencias = [r['nombre'] for r in conn.execute(query_dep, (user_id,)).fetchall()]
        
        query_imp = 'SELECT DISTINCT t.nombre_impuesto as nombre FROM tipos_impuesto t JOIN recaudaciones r ON r.impuesto_id = t.id JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ? ORDER BY nombre'
        impuestos = [r['nombre'] for r in conn.execute(query_imp, (user_id,)).fetchall()]
        
        query_ban = 'SELECT DISTINCT b.nombre_banco as nombre FROM bancos b JOIN recaudaciones r ON r.banco_id = b.id JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ? ORDER BY nombre'
        bancos = [r['nombre'] for r in conn.execute(query_ban, (user_id,)).fetchall()]
        
        query_doc = 'SELECT DISTINCT t.nombre_documento as nombre FROM tipos_documento t JOIN recaudaciones r ON r.tipo_documento_id = t.id JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ? ORDER BY nombre'
        documentos = [r['nombre'] for r in conn.execute(query_doc, (user_id,)).fetchall()]
        
    conn.close()
    
    return jsonify({
        "dependencias": dependencias,
        "impuestos": impuestos,
        "bancos": bancos,
        "documentos": documentos
    }), 200

@app.route('/api/contribuyentes', methods=['POST'])
@login_required
def add_contribuyente():
    # Deshabilitado por diseño de esquema
    return jsonify({"error": "La tabla de contribuyentes ha sido deshabilitada. Los contribuyentes se extraen automáticamente de las recaudaciones."}), 400

@app.route('/login')
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/register')
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    correo = data.get('correo')
    contrasena = data.get('contrasena')
    
    if not correo or not contrasena:
        return jsonify({"error": "Correo y contraseña son requeridos"}), 400
        
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM usuarios WHERE correo = ?', (correo,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['contrasena'], contrasena):
        session['user_id'] = user['id']
        session['user_nombre'] = f"{user['nombre']} {user['apellido']}"
        session['correo'] = user['correo']
        return jsonify({"success": True}), 200
        
    return jsonify({"error": "Credenciales inválidas"}), 401

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    nombre = data.get('nombre')
    apellido = data.get('apellido')
    cedula = data.get('cedula')
    correo = data.get('correo')
    contrasena = data.get('contrasena')
    
    pregunta_1_id = data.get('pregunta_1_id')
    respuesta_1 = data.get('respuesta_seguridad_1')
    pregunta_2_id = data.get('pregunta_2_id')
    respuesta_2 = data.get('respuesta_seguridad_2')
    
    if not all([nombre, apellido, cedula, correo, contrasena, pregunta_1_id, respuesta_1, pregunta_2_id, respuesta_2]):
        return jsonify({"error": "Todos los campos son requeridos"}), 400
        
    conn = get_db_connection()
    
    # Verificar si cedula o correo ya existen
    existing = conn.execute('SELECT id FROM usuarios WHERE cedula = ? OR correo = ?', (cedula, correo)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "El correo o cédula ya se encuentran registrados"}), 400
        
    hashed_password = generate_password_hash(contrasena)
    
    try:
        conn.execute('''
            INSERT INTO usuarios (nombre, apellido, cedula, correo, contrasena, pregunta_1_id, respuesta_seguridad_1, pregunta_2_id, respuesta_seguridad_2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (nombre, apellido, cedula, correo, hashed_password, pregunta_1_id, respuesta_1, pregunta_2_id, respuesta_2))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
        
    conn.close()
    return jsonify({"success": True}), 201

@app.route('/recover')
def recover():
    return render_template('recover.html')

@app.route('/recover_step2')
def recover_step2():
    return render_template('recover_step2.html')

@app.route('/api/recover/identify', methods=['POST'])
def recover_identify():
    identificacion = request.json.get('identificacion')
    if not identificacion:
        return jsonify({"error": "Correo o Cédula es requerido"}), 400
        
    conn = get_db_connection()
    user = conn.execute('''
        SELECT u.id, p1.pregunta as p1, p2.pregunta as p2 
        FROM usuarios u
        JOIN preguntas_seguridad p1 ON u.pregunta_1_id = p1.id
        JOIN preguntas_seguridad p2 ON u.pregunta_2_id = p2.id
        WHERE u.correo = ? OR u.cedula = ?
    ''', (identificacion, identificacion)).fetchone()
    conn.close()
    
    if user:
        session['recover_user_id'] = user['id']
        return jsonify({"success": True, "preguntas": [user['p1'], user['p2']]}), 200
        
    return jsonify({"error": "Usuario no encontrado en el sistema"}), 404

@app.route('/api/recover/verify', methods=['POST'])
def recover_verify():
    if 'recover_user_id' not in session:
        return jsonify({"error": "Sesión inválida, vuelve a intentarlo"}), 400
        
    r1 = request.json.get('respuesta_1', '').strip().lower()
    r2 = request.json.get('respuesta_2', '').strip().lower()
    
    conn = get_db_connection()
    user = conn.execute('SELECT respuesta_seguridad_1, respuesta_seguridad_2 FROM usuarios WHERE id = ?', (session['recover_user_id'],)).fetchone()
    conn.close()
    
    if user:
        if user['respuesta_seguridad_1'].strip().lower() == r1 and user['respuesta_seguridad_2'].strip().lower() == r2:
            session['recover_verified'] = True
            return jsonify({"success": True}), 200
            
    return jsonify({"error": "Las respuestas no coinciden con nuestros registros"}), 401

@app.route('/api/recover/reset', methods=['POST'])
def recover_reset():
    if 'recover_user_id' not in session or not session.get('recover_verified'):
        return jsonify({"error": "No estás autorizado para realizar esta acción"}), 401
        
    nueva_contrasena = request.json.get('contrasena')
    if not nueva_contrasena:
        return jsonify({"error": "La nueva contraseña es requerida"}), 400
        
    hashed_password = generate_password_hash(nueva_contrasena)
    
    conn = get_db_connection()
    conn.execute('UPDATE usuarios SET contrasena = ? WHERE id = ?', (hashed_password, session['recover_user_id']))
    conn.commit()
    conn.close()
    
    # Limpiar sesión temporal de recuperación
    session.pop('recover_user_id', None)
    session.pop('recover_verified', None)
    
    return jsonify({"success": True}), 200

@app.route('/api/data')
@login_required
def get_data():
    conn = get_db_connection()
    lote_id = request.args.get('lote')
    is_admin = session.get('correo') == 'admin@seniat.gob.ve'
    user_id = session.get('user_id')
    
    query = '''
        SELECT 
            MAX(r.id) as "Lote de Entrada",
            r.codigo_control as "Código Forma",
            r.codigo_control as "Forma",
            d.nombre_dependencia as "Código Dependencia",
            d.nombre_dependencia as "Dependencia",
            b.codigo_banco as "Código Banco",
            b.nombre_banco as "Banco",
            td.nombre_documento as "Tipo de Documento",
            ti.nombre_impuesto as "Impuesto",
            r.rif as "RIF",
            r.razon_social as "Razón Social",
            r.periodo as "Período",
            r.numero_documento as "Número de Documento",
            r.rif as "RIF.1",
            r.monto as "Monto",
            r.fecha_recaudacion as "Fechas de Recaudación"
        FROM recaudaciones r
        JOIN dependencias d ON r.dependencia_id = d.id
        JOIN bancos b ON r.banco_id = b.id
        JOIN tipos_documento td ON r.tipo_documento_id = td.id
        JOIN tipos_impuesto ti ON r.impuesto_id = ti.id
    '''
    
    params = []
    
    if not is_admin:
        query += ' JOIN historial_lotes h ON r.id = h.id WHERE h.usuario_id = ?'
        params.append(user_id)
        if lote_id:
            query += ' AND r.id = ?'
            params.append(lote_id)
    else:
        if lote_id:
            query += ' WHERE r.id = ?'
            params.append(lote_id)
            
    query += '''
        GROUP BY 
            r.dependencia_id, r.codigo_control, r.banco_id, r.tipo_documento_id, 
            r.impuesto_id, r.rif, r.razon_social, r.periodo, r.numero_documento, 
            r.monto, r.fecha_recaudacion
    '''
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    data = [dict(row) for row in rows]
    return jsonify({"data": data}), 200

@app.route('/api/lotes', methods=['GET'])
@login_required
def get_lotes():
    conn = get_db_connection()
    if session.get('correo') == 'admin@seniat.gob.ve':
        lotes = conn.execute('''
            SELECT 
                h.id as "Lote",
                u.nombre || ' ' || u.apellido as "Usuario",
                datetime(h.fecha_carga, 'localtime') as "Fecha",
                h.cantidad_registros as "Registros"
            FROM historial_lotes h
            JOIN usuarios u ON h.usuario_id = u.id
            ORDER BY h.fecha_carga DESC
        ''').fetchall()
    else:
        lotes = conn.execute('''
            SELECT 
                h.id as "Lote",
                u.nombre || ' ' || u.apellido as "Usuario",
                datetime(h.fecha_carga, 'localtime') as "Fecha",
                h.cantidad_registros as "Registros"
            FROM historial_lotes h
            JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.usuario_id = ?
            ORDER BY h.fecha_carga DESC
        ''', (session.get('user_id'),)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in lotes]), 200

def save_to_database(parsed_data, user_id):
    conn = get_db_connection()
    bancos_cache = {}
    dependencias_cache = {}
    docs_cache = {}
    impuestos_cache = {}
    
    def get_or_create_banco(codigo, nombre):
        if codigo in bancos_cache: return bancos_cache[codigo]
        b = conn.execute('SELECT id FROM bancos WHERE codigo_banco = ?', (codigo,)).fetchone()
        if b:
            bancos_cache[codigo] = b['id']
            return b['id']
        conn.execute('INSERT INTO bancos (codigo_banco, nombre_banco) VALUES (?, ?)', (codigo, nombre))
        conn.commit()
        b_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        bancos_cache[codigo] = b_id
        return b_id
        
    def get_or_create_dependencia(nombre):
        if nombre in dependencias_cache: return dependencias_cache[nombre]
        d = conn.execute('SELECT id FROM dependencias WHERE nombre_dependencia = ?', (nombre,)).fetchone()
        if d:
            dependencias_cache[nombre] = d['id']
            return d['id']
        conn.execute('INSERT INTO dependencias (nombre_dependencia) VALUES (?)', (nombre,))
        conn.commit()
        d_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        dependencias_cache[nombre] = d_id
        return d_id
        
    def get_or_create_tipo_doc(nombre):
        if nombre in docs_cache: return docs_cache[nombre]
        d = conn.execute('SELECT id FROM tipos_documento WHERE nombre_documento = ?', (nombre,)).fetchone()
        if d:
            docs_cache[nombre] = d['id']
            return d['id']
        conn.execute('INSERT INTO tipos_documento (nombre_documento) VALUES (?)', (nombre,))
        conn.commit()
        d_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        docs_cache[nombre] = d_id
        return d_id
        
    def get_or_create_impuesto(nombre):
        if nombre in impuestos_cache: return impuestos_cache[nombre]
        # Usamos el nombre también como código temporalmente ya que viene junto en el reporte
        i = conn.execute('SELECT id FROM tipos_impuesto WHERE codigo_impuesto = ?', (nombre,)).fetchone()
        if i:
            impuestos_cache[nombre] = i['id']
            return i['id']
        conn.execute('INSERT INTO tipos_impuesto (codigo_impuesto, nombre_impuesto, descripcion) VALUES (?, ?, ?)', (nombre, nombre, nombre))
        conn.commit()
        i_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        impuestos_cache[nombre] = i_id
        return i_id

    conn.execute('INSERT INTO historial_lotes (usuario_id, cantidad_registros) VALUES (?, ?)', (user_id, 0))
    current_carga = conn.execute('SELECT last_insert_rowid()').fetchone()[0]

    inserted = 0
    ignored = 0
    
    for row in parsed_data:
        cod_forma = str(row.get('Código Forma', ''))
        dep = str(row.get('Dependencia', ''))
        cod_banco = str(row.get('Código Banco', ''))
        banco = str(row.get('Banco', ''))
        tipo_doc = str(row.get('Tipo de Documento', ''))
        impuesto = str(row.get('Impuesto', ''))
        rif = str(row.get('RIF', ''))
        razon_social = str(row.get('Razón Social', ''))
        periodo = str(row.get('Período', ''))
        num_doc = str(row.get('Número de Documento', ''))
        monto = float(row.get('Monto', 0.0))
        fecha_rec = str(row.get('Fechas de Recaudación', ''))
        
        # Ignorar si no hay datos mínimos
        if not num_doc or not rif:
            continue
            
        banco_id = get_or_create_banco(cod_banco, banco)
        dep_id = get_or_create_dependencia(dep)
        doc_id = get_or_create_tipo_doc(tipo_doc)
        imp_id = get_or_create_impuesto(impuesto)
        
        # Validación de duplicados: se chequean TODOS los campos y deben coincidir además en el mismo lote (current_carga)
        existing = conn.execute('''
            SELECT id FROM recaudaciones 
            WHERE id = ? AND dependencia_id = ? AND codigo_control = ? AND banco_id = ? AND tipo_documento_id = ? AND impuesto_id = ? AND rif = ? AND razon_social = ? AND periodo = ? AND numero_documento = ? AND monto = ? AND fecha_recaudacion = ?
        ''', (current_carga, dep_id, cod_forma, banco_id, doc_id, imp_id, rif, razon_social, periodo, num_doc, monto, fecha_rec)).fetchone()
        
        if existing:
            ignored += 1
            continue
            
        conn.execute('''
            INSERT INTO recaudaciones (
                id, dependencia_id, codigo_control, codigo_subtipo, codigo_area, banco_id, tipo_documento_id, impuesto_id,
                rif, razon_social, periodo, numero_documento, monto, fecha_recaudacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            current_carga, dep_id, cod_forma, '', '', banco_id, doc_id, imp_id,
            rif, razon_social, periodo, num_doc, monto, fecha_rec
        ))
        inserted += 1
        
    conn.execute('UPDATE historial_lotes SET cantidad_registros = ? WHERE id = ?', (inserted, current_carga))
    conn.commit()
    conn.close()
    return inserted, ignored

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    files = request.files.getlist('file')
    action = request.form.get('action', 'read')
    
    if not files or files[0].filename == '':
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400
        
    result, status_code = process_files(files)
    
    # Si todo salió bien y la acción es guardar en BD
    if status_code == 200 and action == 'save' and 'data' in result:
        inserted, ignored = save_to_database(result['data'], session['user_id'])
        result['message'] = "Se guardaron exitosamente"
        
    return jsonify(result), status_code

if __name__ == '__main__':
    # Ejecuta el servidor Flask en modo debug para desarrollo
    app.run(debug=True, port=5000)
