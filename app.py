from flask import Flask, render_template, request, jsonify
from data_handler import process_files

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    files = request.files.getlist('file')
    if not files or files[0].filename == '':
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400
        
    result, status_code = process_files(files)
    return jsonify(result), status_code

if __name__ == '__main__':
    # Ejecuta el servidor Flask en modo debug para desarrollo
    app.run(debug=True, port=5000)
