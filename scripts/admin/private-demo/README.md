# Demostración privada: herramientas administrativas

Estas herramientas preparan exclusivamente el espacio ficticio autorizado de NormativaCheck. No son el registro normal, una API pública, una migración ni un seed de arranque. No ejecutarlas con `npm start`, Docker Compose, CI, instalación o reinicio.

## Archivos y ubicación

Mantener juntos en `scripts/admin/private-demo/`:

- `workspace-demo.cjs`: inspección limitada y provisión de la organización.
- `demo-scenario.cjs`: carga explícita del escenario, después de la provisión.
- `workspace-demo.test.cjs`: prueba aislada con un proceso MongoDB propio.
- Este README.

Los operadores originales se conservan sin modificaciones. No incorporarlos a la imagen de producción mediante nuevas instrucciones COPY ni moverlos bajo `backend/scripts/`. Su presencia en Git no autoriza su ejecución. La adaptación del test no cambia las huellas de los operadores.

## Alcance y condiciones del operador

Los operadores están deliberadamente limitados a `normativacheck@gmail.com`, la organización `Demostración NormativaCheck`, el origen `https://10.77.77.1:8443`, la base `nc_private` y la réplica `nc-private-rs`. No son una utilidad genérica para otros despliegues o usuarios. `DEMO00001` es un identificador sintético, no un NIF válido.

La cuenta debe existir y haber completado una verificación real de correo antes de conceder la membresía. No se modifican contraseñas, MFA, verificación de correo, versión de sesión ni permisos globales. El acceso concedido es de administrador de esta organización, nunca de otras empresas.

Un responsable del despliegue debe proporcionar un ejecutor revisado que compruebe imagen, contenedor, configuración y huellas vigentes, adquiera el bloqueo de operación y exponga ambos scripts como archivos externos de solo lectura. La ejecución exige `/app`, UID 1000 y configuración privada de producción válida. Los modos de escritura requieren terminal interactiva y confirmación explícita. No se ofrece aquí un comando Docker genérico que omita estos controles.

Secuencia administrativa:

1. Confirmar recepción del correo, verificación e inicio de sesión reales. Nunca introducir tokens o contraseñas en incidencias, argumentos o Git.
2. Ejecutar el modo `inspect` de `workspace-demo.cjs` mediante el ejecutor revisado: solo devuelve identidad, estado de verificación, MFA y número de membresías.
3. Ejecutar `provision` con la autorización explícita mostrada en la terminal y una referencia no secreta. Crea organización y membresía en una transacción.
4. Confirmar en el navegador que aparece el espacio correcto.
5. Ejecutar `demo-scenario.cjs` mediante el mismo control operativo y confirmar `CARGAR DEMO` con el identificador mostrado. Solo admite el espacio autorizado y vacío.
6. Revisar las tareas e histórico en la interfaz antes de grabar.

La carga crea una pyme ficticia con tres servicios, operaciones, espacios, alcances preliminares, requisitos y actuaciones en distintos estados. No crea cuentas de compañeros, evidencias examinadas, revisiones favorables ni certificaciones. Terminar una tarea no equivale a acreditar cumplimiento.

Cada servicio conserva sus transacciones e histórico; la carga completa no es una transacción única. Ante un fallo parcial, conservar datos y recibo técnico, detenerse y revisar. No repetir automáticamente, borrar el espacio, restaurar la base ni reinicializar volúmenes. Una repetición completada no sobrescribe ediciones posteriores. La herramienta rechaza adoptar organizaciones existentes o reactivar membresías revocadas.

## Prueba aislada desde un clon limpio

Requisitos: Node.js 24, dependencias instaladas con el lockfile de `backend`, y un ejecutable local de MongoDB compatible con la aplicación (la evidencia original utilizó MongoDB 7.0.14). El test no descarga MongoDB ni acepta una URI de base existente. Usar una máquina de desarrollo sin credenciales del despliegue, no el servidor de producción.

Desde la raíz del clon, instalar dependencias mediante `npm ci --prefix backend`. No usar `NODE_PATH`, enlaces a node_modules de otro checkout ni dependencias prestadas.

Indicar la ruta absoluta de un ejecutable `mongod` de confianza. Ejemplos que requieren sustituir la ruta:

```powershell
$env:NC_DEMO_QA_MONGOD = 'C:\ruta\mongodb\bin\mongod.exe'
node --test scripts/admin/private-demo/workspace-demo.test.cjs
```

```sh
NC_DEMO_QA_MONGOD=/ruta/absoluta/mongod node --test scripts/admin/private-demo/workspace-demo.test.cjs
```

La suite importa exclusivamente modelos, servicios y dependencias de `backend` en ese clon. Levanta su propio Mongo en loopback y puerto efímero, con un directorio temporal nuevo. Antes de inicializar la réplica verifica que el servidor que respondió corresponde al PID del proceso creado. La cuenta y la verificación simulada pertenecen únicamente a esa base temporal; no acreditan la verificación de una cuenta real.

Al terminar, detiene solo su proceso hijo y conserva el directorio temporal como evidencia. No mata procesos Mongo ajenos ni borra datos. Si no se puede lanzar el binario o faltan dependencias, la prueba falla: no se interpreta como éxito ni se omite silenciosamente.

## Estado de verificación

Los operadores originales tuvieron 15 pruebas satisfactorias en una réplica Mongo aislada de desarrollo. Ese resultado precede a esta adaptación de rutas y no acredita por sí solo la suite portable, un clon limpio, Docker, la interfaz o Hetzner. Registrar por separado el commit exacto y el resultado de la ejecución portable antes de dar por verificada la integración. La ejecución administrativa real requiere además el control del operador descrito arriba.
