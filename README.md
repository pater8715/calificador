# Calificador · Matemáticas 5°

App web instalable para calificar con la cámara del iPhone las hojas de respuesta de selección múltiple (20 preguntas, opciones A–D) de Matemáticas 5°.

- **Escaneo en vivo:** apunta la cámara a una tirilla; cuando ve los cuatro cuadros negros, lee el número de lista y las respuestas.
- **Corrección manual:** toca una burbuja o una casilla para cambiar una lectura dudosa.
- **Resultados por grupo:** nota de 1,0 a 5,0, desempeño, promedio, quiénes faltan; exporta CSV o copia para Excel.
- **Análisis por pregunta:** porcentaje de aciertos y qué opción incorrecta escogió el grupo.
- **Privacidad:** listas y notas se guardan solo en el teléfono (localStorage). Este repositorio no contiene datos de estudiantes.

## Instalar en el iPhone
1. Abre la dirección de GitHub Pages en **Safari**.
2. Toca **Compartir → Agregar a pantalla de inicio**.
3. Abre la app desde el ícono, ve a **Ajustes → Importar listas** y elige los Excel del colegio o el archivo de listas.

## Archivos
- `index.html` — la app (sin dependencias; SheetJS se carga solo al importar un Excel).
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — instalación y uso sin internet.
- `hoja/hoja-de-respuestas-oficio.pdf` — hoja para imprimir (4 tirillas por hoja oficio).
- `herramientas/hoja_omr.py` — genera la hoja en LaTeX. `herramientas/omr.js` — el lector. Las coordenadas de ambos deben coincidir.

Mag. Alberto Paternina León
