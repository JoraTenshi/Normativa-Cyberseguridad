# Origen y licencias de terceros

Inventario revisado el 16 de octubre de 2026. **Documento preparado para integración, no declaración de que el paquete final esté ya auditado o publicado.**

## Alcance de la revisión

La revisión delegada, de solo lectura, se ha realizado sobre la copia de aceptación `work/local-demo-acceptance-20261016/source`, identificada por su manifiesto como un candidato sobre `f1dbd3496743e068bc9fc44e082cdec17d38a1cb`. Las versiones NPM siguientes proceden de sus lockfiles; las licencias y los orígenes se han contrastado con los metadatos oficiales de cada versión en npm. No se han instalado paquetes durante esta revisión.

La [licencia MIT del proyecto](../LICENSE) se aplica al código original que el grupo puede licenciar. **No modifica las licencias de las dependencias ni acredita permisos sobre recursos ajenos.** El inventario no sustituye los textos de licencia, avisos de copyright y otros notices que deban acompañar a una redistribución.

## Dependencias NPM directas

| Ámbito | Paquete | Versión del lock | Licencia declarada | Origen declarado |
|---|---|---|---|---|
| Backend | bcryptjs | 2.4.3 | MIT | [dcodeIO/bcrypt.js](https://github.com/dcodeIO/bcrypt.js) |
| Backend | cookie-parser | 1.4.7 | MIT | [expressjs/cookie-parser](https://github.com/expressjs/cookie-parser) |
| Backend | cors | 2.8.6 | MIT | [expressjs/cors](https://github.com/expressjs/cors) |
| Backend | dotenv | 16.6.1 | BSD-2-Clause | [motdotla/dotenv](https://github.com/motdotla/dotenv) |
| Backend | exceljs | 4.4.0 | MIT | [exceljs/exceljs](https://github.com/exceljs/exceljs) |
| Backend | express | 4.22.3 | MIT | [expressjs/express](https://github.com/expressjs/express) |
| Backend | express-rate-limit | 7.5.1 | MIT | [express-rate-limit/express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) |
| Backend | helmet | 7.2.0 | MIT | [helmetjs/helmet](https://github.com/helmetjs/helmet) |
| Backend | jsonwebtoken | 9.0.3 | MIT | [auth0/node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) |
| Backend | mongoose | 8.24.4 | MIT | [Automattic/mongoose](https://github.com/Automattic/mongoose) |
| Backend | nodemailer | 10.0.14 | MIT-0 | [nodemailer/nodemailer](https://github.com/nodemailer/nodemailer) |
| Backend | qrcode | 1.5.4 | MIT | [soldair/node-qrcode](https://github.com/soldair/node-qrcode) |
| Backend | speakeasy | 2.0.0 | MIT | [speakeasyjs/speakeasy](https://github.com/speakeasyjs/speakeasy) |
| Backend / desarrollo | nodemon | 3.1.14 | MIT | [remy/nodemon](https://github.com/remy/nodemon) |
| Backend / desarrollo | supertest | 7.3.0 | MIT | [ladjs/supertest](https://github.com/ladjs/supertest) |
| Frontend | axios | 1.20.0 | MIT | [axios/axios](https://github.com/axios/axios) |
| Frontend | react | 18.3.1 | MIT | [facebook/react](https://github.com/facebook/react) |
| Frontend | react-dom | 18.3.1 | MIT | [facebook/react](https://github.com/facebook/react) |
| Frontend | react-router-dom | 6.30.6 | MIT | [remix-run/react-router](https://github.com/remix-run/react-router) |
| Frontend / compilación | react-scripts | 5.0.1 | MIT | [facebook/create-react-app](https://github.com/facebook/create-react-app) |
| Frontend / desarrollo | @testing-library/react | 14.3.1 | MIT | [testing-library/react-testing-library](https://github.com/testing-library/react-testing-library) |
| Frontend / desarrollo | @testing-library/jest-dom | 6.6.3 | MIT | [testing-library/jest-dom](https://github.com/testing-library/jest-dom) |

Son 22 dependencias directas: 20 MIT, una BSD-2-Clause y una MIT-0. El override `uuid:11.1.1` de ExcelJS es transitivo, no una dependencia directa adicional. Este recuento no es una auditoría de todo el árbol transitivo.

Los metadatos exactos pueden consultarse en `https://registry.npmjs.org/<paquete>/<version>`; para paquetes con ámbito, codificar la barra del nombre como `%2f`. El lockfile y el paquete efectivamente distribuido deben concordar con este inventario en el corte final.

## Dependencias Python declaradas

| Archivo | Declaración | Licencia consultada | Fuente |
|---|---|---|---|
| `scraper/requirements.txt` | `requests==2.34.2` | Apache-2.0 | [Metadatos de la versión](https://pypi.org/pypi/requests/2.34.2/json), [origen](https://github.com/psf/requests) |
| `scraper/requirements.txt` | `pymongo==4.10.1` | Apache-2.0 | [Metadatos de la versión](https://pypi.org/pypi/pymongo/4.10.1/json), [origen](https://github.com/mongodb/mongo-python-driver) |
| `backend/seed/requirements.txt` | `jsonschema>=4.0,<5` | MIT en 4.0.0 consultada | [Metadatos consultados](https://pypi.org/pypi/jsonschema/4.0.0/json), [origen](https://github.com/python-jsonschema/jsonschema) |

El rango de jsonschema no identifica una versión instalada; habrá que identificarla si se distribuye ese entorno. Inventariar estas declaraciones no acredita que el scraper o esas herramientas se ejecuten en el despliegue actual.

## Avisos que deben acompañar al material redistribuido

- Componentes MIT: conservar los avisos de copyright y permiso que les correspondan en las copias o partes sustanciales redistribuidas. El nombre del paquete y un enlace no sustituyen dichos avisos. [Texto MIT](https://opensource.org/license/mit).
- dotenv 16.6.1: conservar el aviso de Scott Motte, condiciones y exención BSD-2-Clause; para distribución binaria, incluirlos en la documentación o materiales. [LICENSE exacto](https://raw.githubusercontent.com/motdotla/dotenv/v16.6.1/LICENSE).
- nodemailer 10.0.14: su licencia es MIT-0, no MIT convencional. Mantener la identificación exacta y su texto; se puede conservar voluntariamente el aviso de Andris Reinman. [LICENSE exacto](https://raw.githubusercontent.com/nodemailer/nodemailer/v10.0.14/LICENSE).
- Requests 2.34.2: si se redistribuye, conservar Apache-2.0 y su NOTICE. [NOTICE exacto](https://raw.githubusercontent.com/psf/requests/v2.34.2/NOTICE).
- PyMongo 4.10.1: si se redistribuye, conservar Apache-2.0 y los avisos de terceros del paquete, incluidos los de `time64.c` y `bson-stdint-win32.h`. [THIRD-PARTY-NOTICES](https://raw.githubusercontent.com/mongodb/mongo-python-driver/4.10.1/THIRD-PARTY-NOTICES), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).

En el empaquetado final hay que conservar también los avisos generados por el compilador, como los archivos `.LICENSE.txt` del bundle, y comprobar las condiciones de los componentes realmente incluidos. Este documento no cubre exhaustivamente dependencias transitivas, imágenes Docker o paquetes de sistema y **no afirma que se hayan incorporado ya todos los notices al artefacto final**.

## Recursos gráficos y sonoros

| Ruta | Uso observado en la copia revisada | Estado de procedencia |
|---|---|---|
| `frontend/src/images/sadpepe.gif` | Importado por `useJoseEE.jsx` | Origen, autoría y permiso no acreditados |
| `frontend/src/images/ee.mp3` | Importado por `useJoseEE.jsx` para un audio en bucle | Obra, autoría y permiso no acreditados |
| `frontend/src/images/cyber.png` | Versionado; no se encontró importación actual | Origen, autoría y permiso no acreditados |
| `frontend/public/favicon.svg` | Referenciado por `frontend/public/index.html`; contiene geometría y texto SVG | No se identificó origen externo incrustado; el formato por sí solo no acredita autoría |

No se encontró un montaje o importación de `useJoseEE` / `DevToolsEasterEgg` desde otro módulo. Esto no demuestra que GIF y MP3 formen parte del bundle desplegado; sí están presentes en las fuentes versionadas.

Frontend ha confirmado que no dispone de evidencia de origen/licencia para los tres binarios. José ha aclarado que eran memes obtenidos de Internet y que no recuerda su procedencia; no son recursos acreditados como creación propia. El autor de un commit no prueba la titularidad del contenido. **MIT no se extiende automáticamente a estos recursos**, ni la ausencia de documentación demuestra por sí sola una infracción.

Comprobación propia mediante la API de GitHub a las `2026-10-16T20:22:10Z`: los tres binarios y `frontend/src/components/useJoseEE.jsx` siguen en el árbol de `main`, commit `2f52aac139a7d606d9102d55e95005be5e58949e`. También están en la copia de aceptación local. No encontrar un montaje del componente explica que no se vean en la interfaz, pero no equivale a su retirada del repositorio.

José ha autorizado posteriormente retirar exactamente esos tres binarios y `useJoseEE.jsx` del corte de entrega, sin tocar el historial. Front revisará las referencias y pruebas; Servidor realizará la integración Git sobre un candidato aislado y congelado. A las 22:28 CEST esta revisión solo acredita autorización y coordinación, no retirada ejecutada, publicación o despliegue. La conservación de los commits históricos significa que los recursos seguirán accesibles en esos commits: la retirada del árbol final no resuelve ni acredita retrospectivamente sus licencias. MIT continúa limitada al código propio.

## Comprobación pendiente del corte final

Actualización de integración: los cuatro archivos autorizados se han retirado del árbol del candidato consolidado, no del historial. Los lockfiles no se han modificado durante esta integración. La compilación y revisión de avisos del corte final todavía requieren su recibo propio; el resultado previo de una copia de QA no acredita automáticamente ese artefacto final.

1. Confirmar que los locks finales mantienen estas versiones; actualizar solo las filas afectadas si cambian.
2. Verificar la retirada autorizada de los cuatro archivos del árbol y del artefacto final, las referencias restantes y las pruebas; registrar SHA y mantener explícita su presencia histórica. No ampliar la retirada a otros recursos.
3. Comprobar la conservación de los avisos en fuentes, paquetes y bundle realmente redistribuidos.
4. Identificar aquí el commit entregado y la evidencia de esa comprobación, sin convertir este inventario preparatorio en una auditoría exhaustiva.
