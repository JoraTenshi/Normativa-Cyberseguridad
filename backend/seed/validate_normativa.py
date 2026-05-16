#!/usr/bin/env python3
"""
validate_normativa.py
─────────────────────────────────────────────────────────────────────────────
Validador de archivos JSON de normativa para el proyecto NormativaCheck.

QUÉ HACE ESTE SCRIPT
====================
Toma un archivo .json producido por Cris (o por la IA que ella usa) y comprueba
que cumple el "contrato de datos" del proyecto antes de que llegue al back-end.

Realiza DOS rondas de validación:

  1. Validación estructural: ¿están presentes todos los campos obligatorios?
     ¿son del tipo correcto? ¿los enums tienen valores válidos? ¿los pesos
     están dentro del rango permitido? Esto se delega a la biblioteca
     `jsonschema`, que compara el documento con `schema_normativa.json`.

  2. Validación de reglas de negocio: la regla "suma de peso_bloque = 100"
     no se puede expresar en JSON Schema puro, así que la comprobamos aquí
     en Python a mano.

CÓMO SE USA
===========
    # Validación manual de un archivo concreto:
    python3 validate_normativa.py NIS2_normativa.json

    # Especificando un esquema alternativo:
    python3 validate_normativa.py --esquema otro_schema.json archivo.json

CÓDIGOS DE SALIDA
=================
El script termina con uno de estos códigos (exit codes), que es la forma
estándar en Unix/Linux de comunicarle al shell que llamó al script si todo
ha ido bien o no. Los hooks de pre-commit y los pipelines de CI los leen
automáticamente para decidir si bloquean o no la operación.

    0 → Archivo válido (todo OK)
    1 → Archivo inválido (errores de esquema o de regla de negocio)
    2 → Error de uso (archivo no encontrado, JSON malformado, etc.)

DEPENDENCIAS
============
    pip3 install jsonschema

La biblioteca `jsonschema` implementa el estándar JSON Schema (Draft 2020-12)
y es la opción de referencia en Python para esta tarea.
─────────────────────────────────────────────────────────────────────────────
"""

import argparse  # Manejo de argumentos de línea de comandos. Estándar de Python.
import json      # Serialización/deserialización JSON. Built-in.
import sys       # Acceso al intérprete (sys.exit, sys.stderr).
from pathlib import Path  # Manejo de rutas de fichero moderno y portable.

# Importamos solo el validador del estándar más reciente (Draft 2020-12).
# La biblioteca jsonschema admite versiones anteriores también, pero el
# proyecto fija una para asegurar reproducibilidad.
from jsonschema import Draft202012Validator


# ─────────────────────────────────────────────────────────────────────────────
# Códigos de color ANSI para enriquecer la salida en el terminal.
# Funcionan en cualquier terminal moderno (Linux, macOS, WSL, Windows Terminal).
# Si la salida se redirige a un fichero (p. ej. `... > log.txt`) los códigos
# se escriben tal cual; no es ideal, pero no rompe nada.
# ─────────────────────────────────────────────────────────────────────────────
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def cargar_json(ruta: Path) -> dict:
    """
    Lee un fichero JSON desde disco y lo deserializa a un dict de Python.

    Si el fichero no existe o contiene JSON malformado, imprime un error y
    termina el proceso con código 2 (error de uso, no de validación).

    El bloque `with` garantiza que el descriptor de fichero se cierra incluso
    si se produce una excepción durante la lectura. Esto es importante en
    procesos de larga duración (un servidor) y considerado buena práctica
    siempre.

    Especificar `encoding="utf-8"` es crítico aquí: los textos legales en
    español contienen tildes, eñes y caracteres especiales que sin este
    parámetro pueden interpretarse mal en algunos sistemas Windows.
    """
    if not ruta.exists():
        print(f"{RED}✗ Archivo no encontrado: {ruta}{RESET}", file=sys.stderr)
        sys.exit(2)

    try:
        with ruta.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        # json.JSONDecodeError lleva la línea y columna exactas del error,
        # información que es oro puro para depurar JSONs grandes.
        print(f"{RED}✗ JSON malformado en {ruta}{RESET}", file=sys.stderr)
        print(f"  Línea {e.lineno}, columna {e.colno}: {e.msg}", file=sys.stderr)
        sys.exit(2)


def formatear_ruta(path) -> str:
    """
    Convierte la 'ruta interna' que jsonschema usa para señalar dónde está
    un error (una secuencia de claves e índices) en notación JSONPath legible.

    jsonschema nos da algo como:   deque(['bloques', 2, 'peso_bloque'])
    Nosotros queremos imprimir:    bloques[2].peso_bloque

    JSONPath es la convención estándar de la industria para localizar un
    nodo dentro de un documento JSON, igual que XPath para XML.

    Ejemplos:
        ()                                  → "(raíz)"
        ('id',)                             → "id"
        ('bloques', 2, 'peso_bloque')       → "bloques[2].peso_bloque"
        ('bloques', 0, 'preguntas', 3, 'tipo') → "bloques[0].preguntas[3].tipo"
    """
    if not path:
        return "(raíz)"

    partes = []
    for elemento in path:
        if isinstance(elemento, int):
            # Si el elemento es un entero, es un índice de array: lo pegamos
            # al ítem anterior con corchetes.
            if partes:
                partes[-1] += f"[{elemento}]"
            else:
                partes.append(f"[{elemento}]")
        else:
            partes.append(str(elemento))
    return ".".join(partes)


def validar_estructura(datos: dict, esquema: dict) -> list[tuple[str, str]]:
    """
    Aplica la validación estructural delegando en la biblioteca jsonschema.

    Devuelve una lista de tuplas (ruta_legible, mensaje_error). Si la lista
    está vacía, el documento es estructuralmente válido.

    USAMOS iter_errors EN LUGAR DE validate:
    `validate` lanza una excepción en el PRIMER error encontrado y se detiene.
    `iter_errors` devuelve un generador con TODOS los errores. Esto es mucho
    más práctico: si una persona deja diez campos mal puestos, prefiere verlos
    todos a la vez y arreglarlos de una pasada, en vez de arreglar uno,
    re-ejecutar, arreglar el siguiente, etc.
    """
    validador = Draft202012Validator(esquema)
    errores = []

    for error in validador.iter_errors(datos):
        ruta = formatear_ruta(error.absolute_path)
        errores.append((ruta, error.message))

    return errores


def validar_pesos_bloque(datos: dict) -> list[tuple[str, str]]:
    """
    Comprueba la regla de negocio: la suma de los pesos de todos los bloques
    de una normativa debe ser EXACTAMENTE 100.

    Esta restricción es una invariante del proyecto, decidida por diseño
    para que las normativas sean comparables entre sí en porcentaje. JSON
    Schema no tiene forma de expresar "la suma de un campo de varios objetos
    en un array debe ser X", así que la validamos a mano.

    NOTA SOBRE TOLERANCIA A ERRORES:
    Usamos .get("peso_bloque", 0) y comprobamos isinstance(b, dict) por si
    el documento es estructuralmente inválido (ya capturado por la validación
    de esquema). Así esta función no rompe; simplemente puede dar un total
    inesperado, pero el usuario verá primero los errores estructurales.
    """
    errores = []
    bloques = datos.get("bloques", [])

    suma = sum(
        b.get("peso_bloque", 0)
        for b in bloques
        if isinstance(b, dict)
    )

    if suma != 100:
        errores.append((
            "bloques[*].peso_bloque",
            f"La suma de pesos de bloque es {suma}; debe ser exactamente 100."
        ))

    return errores


def imprimir_resumen(datos: dict) -> None:
    """
    Cuando la validación tiene éxito, imprime estadísticas útiles para que
    Jose / Jorge / Cris vean de un vistazo qué se ha validado realmente.
    """
    bloques = datos.get("bloques", [])
    n_bloques   = len(bloques)
    n_preguntas = sum(len(b.get("preguntas", [])) for b in bloques)
    suma_pesos  = sum(b.get("peso_bloque", 0) for b in bloques)

    print(f"  Normativa:              {datos.get('nombre', '?')}")
    print(f"  ID:                     {datos.get('id', '?')}")
    print(f"  Referencia oficial:     {datos.get('referencia_oficial', '?')}")
    print(f"  Bloques:                {n_bloques}")
    print(f"  Preguntas:              {n_preguntas}")
    print(f"  Suma pesos de bloque:   {suma_pesos}")


def main() -> int:
    """
    Punto de entrada del script. Devuelve el código de salida (no llama a
    sys.exit directamente: deja que sea el llamador quien decida).

    Este patrón ('main devuelve int, el wrapper hace sys.exit') es estándar
    en Python y facilita el testing: los tests pueden invocar main() y
    comprobar el valor devuelto sin que el proceso se termine.
    """
    # argparse construye automáticamente un parser que entiende --help, valida
    # tipos, genera mensajes de error útiles, etc. Es la forma estándar de
    # hacer CLIs en Python desde la versión 3.2.
    parser = argparse.ArgumentParser(
        description="Valida un archivo JSON de normativa contra el esquema canónico de NormativaCheck.",
        epilog="Si no se especifica --esquema, se busca schema_normativa.json en el mismo directorio que este script."
    )
    parser.add_argument(
        "archivo",
        type=Path,
        help="Ruta al archivo .json de la normativa a validar"
    )
    parser.add_argument(
        "--esquema",
        type=Path,
        default=Path(__file__).parent / "schema_normativa.json",
        help="Ruta al archivo de esquema JSON Schema"
    )
    args = parser.parse_args()

    # Cabecera de la salida.
    print(f"{BOLD}Validando:{RESET} {args.archivo}")

    # Cargamos los dos JSONs. Si alguno falla, cargar_json sale con código 2.
    esquema = cargar_json(args.esquema)
    datos   = cargar_json(args.archivo)

    # Ejecutamos las dos rondas de validación y concatenamos los errores.
    errores_estructura = validar_estructura(datos, esquema)
    errores_negocio    = validar_pesos_bloque(datos)
    total_errores      = errores_estructura + errores_negocio

    # Caso OK: imprimir resumen y devolver 0.
    if not total_errores:
        print(f"{GREEN}✓ VÁLIDO{RESET}")
        imprimir_resumen(datos)
        return 0

    # Caso ERROR: imprimir cada violación con su ruta y mensaje.
    print(f"{RED}✗ INVÁLIDO — {len(total_errores)} error(es){RESET}")
    for ruta, mensaje in total_errores:
        print(f"  {YELLOW}•{RESET} {BOLD}{ruta}{RESET}")
        print(f"    {mensaje}")
    return 1


# ─────────────────────────────────────────────────────────────────────────────
# Idiom Python: solo ejecutar main() si el fichero se invoca directamente,
# no cuando es importado como módulo desde otro script. Sin esta guarda,
# importar este fichero ejecutaría la validación, lo que sería sorprendente.
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sys.exit(main())
