import PyPDF2
import pandas as pd
import re
import sys
import json

# Función para extraer texto del PDF
def extraer_texto_pdf(ruta_pdf):
    with open(ruta_pdf, 'rb') as archivo_pdf:
        lector_pdf = PyPDF2.PdfReader(archivo_pdf)
        texto = ""
        for pagina in lector_pdf.pages:
            texto += pagina.extract_text()
    return texto

# Función para limpiar el código de producto
def limpiar_codigo_producto(codigo):
    return re.sub(r"<\d+>", "", codigo)

# Función para limpiar la cantidad eliminando las comas
def limpiar_cantidad(cantidad):
    return re.sub(r"[,.]", "", cantidad)

# Función para procesar el PDF y devolver el DataFrame
def procesar_pdf(ruta_pdf):
    if not ruta_pdf:
        return json.dumps({"error": "No se pudo descargar el PDF"})
    
    # Extrae el texto completo del PDF
    texto_pdf = extraer_texto_pdf(ruta_pdf)

    # Filtra solo la sección relevante usando expresiones regulares
    patron_productos = r"(?i)(\d{3})\s+([A-Za-z0-9]+(?:<\d+>)?)\s+(.+?)\s+(UND|PAR|M|MTS|UNID|UNI|UNIDAD|CTMS|UN|U|PZ|INI|KIT|UNA|PZA|MTRS|MTRO|UNDA|UNDAD|UNO|SIN FAMILI|LBS|LB|B|UM|UUND|PIGTAIL|MILILITROS|KILO)\s+(\d+(?:[,.]\d{3})*)+(.+?)\s\n"
    productos = re.findall(patron_productos, texto_pdf)

    # Limpia los códigos de producto y prepara los datos para el PDF
    productos_limpios = [
        (nro, limpiar_codigo_producto(codigo), descripcion, unidad, limpiar_cantidad(cantidad), observaciones or "")
        for nro, codigo, descripcion, unidad, cantidad, observaciones in productos
    ]

    # Crea el DataFrame con los datos extraídos
    columnas = ["NRO.", "PRODUCTO", "DESCRIPCION", "U.M.", "CANTIDAD", "OBSERVACIONES"]
    df_productos = pd.DataFrame(productos_limpios, columns=columnas)

    # Convertir DataFrame a JSON
    return df_productos.to_json(orient="records")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Faltan parámetros: nombre del PDF"}), flush=True)
    else:
        ruta_pdf = sys.argv[1]
        resultado_json = procesar_pdf(ruta_pdf)
        print(resultado_json, flush=True)
        