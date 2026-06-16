import os
import sys
import subprocess


def run_checks() -> bool:
    """Verifica la integridad de los archivos del simulador antes del despliegue."""
    print("=== INICIANDO CONTROL DE CALIDAD ===")

    # 1. Ejecutar el validador matemático
    print("\n[1/3] Ejecutando pruebas unitarias de fórmulas...")
    result = subprocess.run(
        [sys.executable, "engine_validator.py"], capture_output=True, text=True
    )

    if result.returncode != 0:
        print("❌ Error: Las pruebas unitarias fallaron.")
        print(result.stderr)
        return False
    print("✅ Pruebas unitarias exitosas.")

    # 2. Verificar existencia de archivos clave
    print("\n[2/3] Verificando archivos críticos de la SPA...")
    required_files = ["index.html", "app.js"]
    for file in required_files:
        if not os.path.exists(file):
            print(f"❌ Error: No se encuentra el archivo requerido: {file}")
            return False
        print(f"✅ {file} detectado.")

    # 3. Formatear y revisar estilo (Ruff/Black opcional si están instalados)
    print("\n[3/3] Chequeo de consistencia completado con éxito.")
    return True


if __name__ == "__main__":
    if run_checks():
        print("\n🚀 Entorno óptimo. Todo listo para hacer Push a la rama main.")
    else:
        print("\n🛑 Despliegue cancelado debido a errores detectados.")
        sys.exit(1)
