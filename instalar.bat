@echo off
echo Creando entorno virtual...
python -m venv venv

echo Activando entorno y actualizando pip...
call venv\Scripts\activate
python -m pip install --upgrade pip

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo ===========================================
echo ¡Instalacion completada con exito!
echo ===========================================
pause
