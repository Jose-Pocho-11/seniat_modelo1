import sqlite3
import os
from datetime import datetime
from init_db import DB_PATH
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import tempfile
import uuid

def create_chart_image(data_rows, label_key, value_key, title, is_pie=False):
    if not data_rows: return None
    
    chart_data = data_rows[:5]
    labels = []
    for r in chart_data:
        l = str(r[label_key])
        if len(l) > 15: l = l[:12] + '...'
        labels.append(l)
    values = [float(r[value_key]) for r in chart_data]
    
    fig, ax = plt.subplots(figsize=(6, 4))
    if is_pie:
        ax.pie(values, labels=labels, autopct='%1.1f%%', startangle=90, colors=['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'])
        ax.axis('equal')
    else:
        ax.bar(labels, values, color='#3b82f6')
        ax.set_ylabel('Monto (Bs.)')
        plt.xticks(rotation=15, ha='right')
        plt.tight_layout()
        
    plt.title(title)
    
    temp_dir = tempfile.gettempdir()
    img_path = os.path.join(temp_dir, f'chart_{uuid.uuid4().hex}.png')
    plt.savefig(img_path, format='png', bbox_inches='tight')
    plt.close(fig)
    return img_path

def get_report_data(user_id, is_admin):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if is_admin:
        join_clause = ""
        where_clause = ""
        params = []
    else:
        join_clause = "JOIN historial_lotes h ON r.id = h.id"
        where_clause = "WHERE h.usuario_id = ?"
        params = [user_id]
        
    def fetch_data(query):
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    # 1. Total recaudado
    cursor.execute(f"SELECT SUM(r.monto) as total FROM recaudaciones r {join_clause} {where_clause}", params)
    total_row = cursor.fetchone()
    total = total_row['total'] if total_row and total_row['total'] else 0.0
    
    # 2. Por dependencia
    dependencias = fetch_data(f'''
        SELECT d.nombre_dependencia as nombre, SUM(r.monto) as monto 
        FROM recaudaciones r 
        JOIN dependencias d ON r.dependencia_id = d.id 
        {join_clause} {where_clause}
        GROUP BY d.id ORDER BY monto DESC
    ''')
    
    # 3. Por banco
    bancos = fetch_data(f'''
        SELECT b.nombre_banco as nombre, SUM(r.monto) as monto 
        FROM recaudaciones r 
        JOIN bancos b ON r.banco_id = b.id 
        {join_clause} {where_clause}
        GROUP BY b.id ORDER BY monto DESC
    ''')
    
    # 4. Por impuesto
    impuestos = fetch_data(f'''
        SELECT ti.nombre_impuesto as nombre, SUM(r.monto) as monto 
        FROM recaudaciones r 
        JOIN tipos_impuesto ti ON r.impuesto_id = ti.id 
        {join_clause} {where_clause}
        GROUP BY ti.id ORDER BY monto DESC
    ''')
    
    # 5. Por terminal de RIF
    terminales = fetch_data(f'''
        SELECT SUBSTR(r.rif, LENGTH(r.rif)) as terminal, SUM(r.monto) as monto 
        FROM recaudaciones r 
        {join_clause} {where_clause}
        GROUP BY terminal ORDER BY monto DESC
    ''')
    
    # 6. Contribuyentes
    top_contribuyentes = fetch_data(f'''
        SELECT r.rif as rif, r.razon_social as razon_social, SUM(r.monto) as monto 
        FROM recaudaciones r 
        {join_clause} {where_clause}
        GROUP BY r.rif, r.razon_social ORDER BY monto DESC
    ''')
    
    conn.close()
    
    return {
        "total": total,
        "dependencias": dependencias,
        "bancos": bancos,
        "impuestos": impuestos,
        "terminales": terminales,
        "top_contribuyentes": top_contribuyentes
    }

def format_bs(amount):
    return f"Bs. {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def generate_pdf_report(user_id, is_admin, output_path):
    data = get_report_data(user_id, is_admin)
    
    doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(name='TitleStyle', parent=styles['Heading1'], alignment=1, fontSize=16, spaceAfter=20)
    subtitle_style = ParagraphStyle(name='SubtitleStyle', parent=styles['Heading2'], fontSize=12, spaceAfter=10, textColor=colors.HexColor('#1e40af'))
    normal_style = styles['Normal']
    
    # Logo
    logo_path = os.path.join(os.path.dirname(__file__), 'static', 'img', 'logo_seniat.png')
    if os.path.exists(logo_path):
        img = Image(logo_path, width=2*Inches, height=0.6*Inches)
        elements.append(img)
        elements.append(Spacer(1, 10))
    
    # Title
    elements.append(Paragraph("<b>Reporte Oficial de Recaudación</b>", title_style))
    elements.append(Paragraph(f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Total
    elements.append(Paragraph(f"<b>Monto Total Recaudado:</b> {format_bs(data['total'])}", styles['Heading3']))
    elements.append(Spacer(1, 15))
    
    def add_table_section(title, headers, rows):
        elements.append(Paragraph(f"<b>{title}</b>", subtitle_style))
        if not rows:
            elements.append(Paragraph("No hay datos disponibles.", normal_style))
            elements.append(Spacer(1, 15))
            return
            
        table_data = [headers]
        for r in rows:
            table_data.append([str(r['nombre'] if 'nombre' in r else r['terminal']), format_bs(r['monto'])])
            
        t = Table(table_data, colWidths=[4*Inches, 2.5*Inches])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Add chart
        img_path = create_chart_image(rows, 'nombre' if 'nombre' in rows[0] else 'terminal', 'monto', f"Gráfica: {title}", is_pie=len(rows) <= 5)
        if img_path:
            elements.append(Image(img_path, width=5*Inches, height=3.3*Inches))
            elements.append(Spacer(1, 20))

    # Add sections
    add_table_section("1. Desglose por Dependencia", ["Dependencia", "Monto"], data['dependencias'])
    add_table_section("2. Desglose por Tipos de Impuesto", ["Impuesto", "Monto"], data['impuestos'])
    add_table_section("3. Desglose por Banco", ["Banco", "Monto"], data['bancos'])
    add_table_section("4. Recaudación por Terminal de RIF", ["Terminal de RIF", "Monto"], data['terminales'])
    
    # Top contribuyentes needs 3 columns
    elements.append(Paragraph("<b>5. Todos los Contribuyentes</b>", subtitle_style))
    if data['top_contribuyentes']:
        table_data = [["RIF", "Razón Social", "Monto"]]
        for r in data['top_contribuyentes']:
            table_data.append([str(r['rif']), str(r['razon_social']), format_bs(r['monto'])])
        t = Table(table_data, colWidths=[1.5*Inches, 3*Inches, 2*Inches])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ]))
        elements.append(t)
    else:
        elements.append(Paragraph("No hay datos disponibles.", normal_style))
        
    doc.build(elements)


def generate_word_report(user_id, is_admin, output_path):
    data = get_report_data(user_id, is_admin)
    
    doc = Document()
    
    # Logo
    logo_path = os.path.join(os.path.dirname(__file__), 'static', 'img', 'logo_seniat.png')
    if os.path.exists(logo_path):
        doc.add_picture(logo_path, width=Inches(2.0))
        last_paragraph = doc.paragraphs[-1]
        last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
    # Title
    title = doc.add_heading('Reporte Oficial de Recaudación', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph(f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    doc.add_paragraph(f"Monto Total Recaudado: {format_bs(data['total'])}").bold = True
    
    def add_word_table(heading, headers, rows):
        doc.add_heading(heading, level=1)
        if not rows:
            doc.add_paragraph("No hay datos disponibles.")
            return
            
        table = doc.add_table(rows=1, cols=len(headers))
        table.style = 'Table Grid'
        
        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
            hdr_cells[i].paragraphs[0].runs[0].bold = True
            
        for r in rows:
            row_cells = table.add_row().cells
            row_cells[0].text = str(r['nombre'] if 'nombre' in r else r['terminal'])
            row_cells[1].text = format_bs(r['monto'])
            
        # Add chart
        img_path = create_chart_image(rows, 'nombre' if 'nombre' in rows[0] else 'terminal', 'monto', f"Gráfica: {heading}", is_pie=len(rows) <= 5)
        if img_path:
            doc.add_picture(img_path, width=Inches(5.0))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            
    add_word_table("1. Desglose por Dependencia", ["Dependencia", "Monto"], data['dependencias'])
    doc.add_page_break()
    add_word_table("2. Desglose por Tipos de Impuesto", ["Impuesto", "Monto"], data['impuestos'])
    add_word_table("3. Desglose por Banco", ["Banco", "Monto"], data['bancos'])
    doc.add_page_break()
    add_word_table("4. Recaudación por Terminal de RIF", ["Terminal de RIF", "Monto"], data['terminales'])
    
    # Top contribuyentes
    doc.add_heading("5. Todos los Contribuyentes", level=1)
    if data['top_contribuyentes']:
        table = doc.add_table(rows=1, cols=3)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = "RIF"
        hdr_cells[1].text = "Razón Social"
        hdr_cells[2].text = "Monto"
        for i in range(3): hdr_cells[i].paragraphs[0].runs[0].bold = True
        
        for r in data['top_contribuyentes']:
            row_cells = table.add_row().cells
            row_cells[0].text = str(r['rif'])
            row_cells[1].text = str(r['razon_social'])
            row_cells[2].text = format_bs(r['monto'])
    else:
        doc.add_paragraph("No hay datos disponibles.")
        
    doc.save(output_path)
