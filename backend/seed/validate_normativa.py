#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def cargar_json(ruta: Path) -> dict:
    if not ruta.exists():
        print(f"{RED}Archivo no encontrado: {ruta}{RESET}", file=sys.stderr)
        sys.exit(2)

    try:
        with ruta.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"{RED}JSON malformado en {ruta}{RESET}", file=sys.stderr)
        print(f"  Línea {e.lineno}, columna {e.colno}: {e.msg}", file=sys.stderr)
        sys.exit(2)


def formatear_ruta(path) -> str:
    if not path:
        return "(raíz)"

    partes = []
    for elemento in path:
        if isinstance(elemento, int):
            if partes:
                partes[-1] += f"[{elemento}]"
            else:
                partes.append(f"[{elemento}]")
        else:
            partes.append(str(elemento))
    return ".".join(partes)


def validar_estructura(datos: dict, esquema: dict) -> list[tuple[str, str]]:
    validador = Draft202012Validator(esquema)
    errores = []

    for error in validador.iter_errors(datos):
        ruta = formatear_ruta(error.absolute_path)
        errores.append((ruta, error.message))

    return errores


def validar_pesos_bloque(datos: dict) -> list[tuple[str, str]]:
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

    print(f"{BOLD}Validando:{RESET} {args.archivo}")

    esquema = cargar_json(args.esquema)
    datos   = cargar_json(args.archivo)

    errores_estructura = validar_estructura(datos, esquema)
    errores_negocio    = validar_pesos_bloque(datos)
    total_errores      = errores_estructura + errores_negocio

    if not total_errores:
        print(f"{GREEN}VÁLIDO{RESET}")
        imprimir_resumen(datos)
        return 0

    print(f"{RED}INVÁLIDO — {len(total_errores)} error(es){RESET}")
    for ruta, mensaje in total_errores:
        print(f"  {YELLOW}-{RESET} {BOLD}{ruta}{RESET}")
        print(f"    {mensaje}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
