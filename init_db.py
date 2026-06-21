import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FOLDER = os.path.join(BASE_DIR, 'Seniat_DB')
DB_PATH = os.path.join(DB_FOLDER, 'seniat.db')

def init_db():
    db_exists = os.path.exists(DB_PATH)
    
    if not db_exists:
        if not os.path.exists(DB_FOLDER):
            os.makedirs(DB_FOLDER)
            
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Habilitar claves foráneas
    cursor.execute('PRAGMA foreign_keys = ON;')
    
    # Ejecutar el esquema completo
    schema = """
    -- 1. TABLA: preguntas_seguridad
    CREATE TABLE IF NOT EXISTS preguntas_seguridad (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pregunta TEXT NOT NULL UNIQUE
    );

    -- 2. TABLA: bancos
    CREATE TABLE IF NOT EXISTS bancos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_banco TEXT NOT NULL UNIQUE,
        nombre_banco TEXT NOT NULL UNIQUE
    );

    -- 3. TABLA: dependencias
    CREATE TABLE IF NOT EXISTS dependencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_dependencia TEXT NOT NULL UNIQUE
    );

    -- 4. TABLA: tipos_impuesto
    CREATE TABLE IF NOT EXISTS tipos_impuesto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_impuesto TEXT NOT NULL UNIQUE,
        nombre_impuesto TEXT NOT NULL,
        descripcion TEXT
    );

    -- 5. TABLA: tipos_documento
    CREATE TABLE IF NOT EXISTS tipos_documento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_documento TEXT NOT NULL UNIQUE
    );

    -- 6. TABLA: usuarios
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        cedula TEXT NOT NULL UNIQUE,
        correo TEXT NOT NULL UNIQUE,
        contrasena TEXT NOT NULL,
        pregunta_1_id INTEGER NOT NULL,
        respuesta_seguridad_1 TEXT NOT NULL,
        pregunta_2_id INTEGER NOT NULL,
        respuesta_seguridad_2 TEXT NOT NULL,
        FOREIGN KEY (pregunta_1_id) REFERENCES preguntas_seguridad (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (pregunta_2_id) REFERENCES preguntas_seguridad (id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    -- 7. TABLA: recaudaciones
    CREATE TABLE IF NOT EXISTS recaudaciones (
        id INTEGER NOT NULL,
        dependencia_id INTEGER NOT NULL,
        codigo_control TEXT NOT NULL,
        codigo_subtipo TEXT NOT NULL,
        codigo_area TEXT NOT NULL,
        banco_id INTEGER,
        tipo_documento_id INTEGER NOT NULL,
        impuesto_id INTEGER NOT NULL,
        rif TEXT NOT NULL,
        razon_social TEXT NOT NULL,
        periodo TEXT NOT NULL,
        numero_documento TEXT NOT NULL,
        monto REAL NOT NULL,                
        fecha_recaudacion TEXT NOT NULL,
        FOREIGN KEY (dependencia_id) REFERENCES dependencias (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (banco_id) REFERENCES bancos (id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (impuesto_id) REFERENCES tipos_impuesto (id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    -- 8. TABLA: historial_lotes
    CREATE TABLE IF NOT EXISTS historial_lotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        fecha_carga DATETIME DEFAULT CURRENT_TIMESTAMP,
        cantidad_registros INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    -- 9. TABLA: calendarios
    CREATE TABLE IF NOT EXISTS calendarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anio INTEGER NOT NULL,
        mes TEXT NOT NULL,
        quincena INTEGER NOT NULL,
        terminal_rif INTEGER NOT NULL,
        dia_vencimiento INTEGER NOT NULL,
        UNIQUE(anio, mes, quincena, terminal_rif)
    );

    -- 10. TABLA: calendarios_dpp
    CREATE TABLE IF NOT EXISTS calendarios_dpp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anio INTEGER NOT NULL,
        mes TEXT NOT NULL,
        terminal_rif INTEGER NOT NULL,
        dia_vencimiento INTEGER NOT NULL,
        UNIQUE(anio, mes, terminal_rif)
    );
    """
    
    # Ejecutar múltiples sentencias SQL
    cursor.executescript(schema)
    
    if not db_exists:
        # 1. Insertar preguntas de seguridad por defecto
        cursor.execute("INSERT OR IGNORE INTO preguntas_seguridad (id, pregunta) VALUES (1, '¿Nombre de tu primera mascota?')")
        cursor.execute("INSERT OR IGNORE INTO preguntas_seguridad (id, pregunta) VALUES (2, '¿Ciudad de nacimiento de tu madre?')")
        
        # 2. Insertar usuario administrador por defecto
        try:
            from werkzeug.security import generate_password_hash
            admin_password = generate_password_hash("admin123")
            
            cursor.execute("""
                INSERT INTO usuarios (nombre, apellido, cedula, correo, contrasena, pregunta_1_id, respuesta_seguridad_1, pregunta_2_id, respuesta_seguridad_2)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("Admin", "Sistema", "V-00000000", "admin@seniat.gob.ve", admin_password, 1, "mascota", 2, "ciudad"))
            print("Usuario administrador creado por defecto. Correo: admin@seniat.gob.ve | Clave: admin123")
        except Exception as e:
            print(f"Error creando administrador: {e}")
    
    conn.commit()
    conn.close()
    print(f"Base de datos verificada/inicializada en: {DB_PATH}")

if __name__ == '__main__':
    init_db()
