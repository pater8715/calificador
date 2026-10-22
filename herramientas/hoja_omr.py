#!/usr/bin/env python3
"""Genera la hoja de respuestas con marcas de lectura (4 tirillas por hoja oficio).

Coordenadas de la plantilla en mm, con origen en el centro del cuadro superior
izquierdo y el eje y hacia abajo. DEBEN coincidir con la constante T de omr.js.

Uso:
  python3 hoja_omr.py hoja.tex                 -> hoja en blanco para imprimir
  python3 hoja_omr.py prueba.tex BDDC... 07    -> tirillas rellenas (pruebas)
  python3 hoja_omr.py --snippet snip.tex       -> solo la página (para input)
"""
import sys

FID = [(0, 0), (180, 0), (180, 46), (0, 46)]
FID_SIZE = 7
ORIENT = (13, 0)
ORIENT_SIZE = 4
R = 2.2
DEC = dict(y=7, x0=40, dx=6, n=5)
UNI = dict(y=7, x0=86, dx=6, n=10)
QX0, QDX, NQ = 14, 8.2, 20
ROWS = [20, 26, 32, 38]
LET = "ABCD"

PAGE_W, PAGE_H = 216, 330
X0 = (PAGE_W - 180) / 2   # 18 mm
Y0, PITCH = 27, 79


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def tirilla(k, resp=None, num=None, relleno="black!85"):
    """Código TikZ de una tirilla; (x, y) en mm con y hacia abajo."""
    y0 = Y0 + PITCH * k
    P = lambda x, y: f"({f(X0 + x)},{f(-(y0 + y))})"
    o = []
    # Encabezado (fuera del área de lectura)
    o.append(rf"\node[font=\bfseries\small] at {P(90, -16.3)} {{HOJA DE RESPUESTAS}};")
    o.append(rf"\node[font=\scriptsize] at {P(90, -12)} {{Evaluación acumulativa de Matemáticas · Tercer período 2026 · Grado 5°}};")
    o.append(rf"\node[font=\scriptsize,anchor=base west] at {P(-3.5, -6)} {{NOMBRE Y APELLIDOS:}};")
    o.append(rf"\draw[line width=0.3pt] {P(30, -6)} -- {P(122, -6)};")
    o.append(rf"\node[font=\scriptsize,anchor=base west] at {P(124, -6)} {{GRUPO:}};")
    o.append(rf"\draw[line width=0.3pt] {P(137, -6)} -- {P(150, -6)};")
    o.append(rf"\node[font=\scriptsize,anchor=base west] at {P(152, -6)} {{FECHA:}};")
    o.append(rf"\draw[line width=0.3pt] {P(164, -6)} -- {P(183.5, -6)};")
    # Cuadros de esquina y marca de orientación
    h = FID_SIZE / 2
    for (x, y) in FID:
        o.append(rf"\fill[black] {P(x - h, y - h)} rectangle {P(x + h, y + h)};")
    h2 = ORIENT_SIZE / 2
    o.append(rf"\fill[black] {P(ORIENT[0] - h2, ORIENT[1] - h2)} rectangle {P(ORIENT[0] + h2, ORIENT[1] + h2)};")

    def burbuja(x, y, txt, lleno=False):
        if lleno:
            o.append(rf"\fill[{relleno}] {P(x, y)} circle ({f(R - 0.1)});")
        o.append(rf"\draw[line width=0.35mm] {P(x, y)} circle ({f(R)});")
        if not lleno:
            o.append(rf"\node[font=\fontsize{{5.5}}{{6}}\selectfont,text=black!45] at {P(x, y)} {{{txt}}};")

    # Número de lista
    o.append(rf"\node[font=\bfseries\scriptsize,anchor=west] at {P(5.5, DEC['y'])} {{N.° DE LISTA}};")
    o.append(rf"\node[font=\scriptsize,anchor=east] at {P(37, DEC['y'])} {{Decenas}};")
    o.append(rf"\node[font=\scriptsize,anchor=east] at {P(83, UNI['y'])} {{Unidades}};")
    d = u = None
    if num is not None:
        d, u = int(num) // 10, int(num) % 10
    for i in range(DEC["n"]):
        burbuja(DEC["x0"] + i * DEC["dx"], DEC["y"], str(i), d == i)
    for i in range(UNI["n"]):
        burbuja(UNI["x0"] + i * UNI["dx"], UNI["y"], str(i), u == i)
    o.append(rf"\draw[line width=0.4pt] {P(150, 3.8)} rectangle {P(172, 10.2)};")
    o.append(rf"\node[font=\tiny,text=black!60,anchor=north west] at {P(150.4, 4.1)} {{N.° escrito}};")
    # Preguntas
    for c, l in enumerate(LET):
        o.append(rf"\node[font=\bfseries\small] at {P(7.5, ROWS[c])} {{{l}}};")
    for q in range(NQ):
        x = QX0 + q * QDX
        o.append(rf"\node[font=\bfseries\scriptsize] at {P(x, 14)} {{{q + 1}}};")
        for c, l in enumerate(LET):
            burbuja(x, ROWS[c], l, bool(resp) and q < len(resp) and (resp[q] == l or (resp[q] == '*' and l in 'AC')))
    xs = QX0 + 9 * QDX + QDX / 2
    o.append(rf"\draw[black!40,line width=0.4pt] {P(xs, 11.5)} -- {P(xs, 40.8)};")
    # Pie
    o.append(rf"\node[font=\scriptsize,anchor=base] at {P(90, 53)} {{Rellena todo el círculo con lápiz o lapicero oscuro. No escribas cerca de los cuadros negros.}};")
    if k < 3:
        yc = y0 + 60.2
        o.append(rf"\draw[dashed,black!45] ({f(4)},{f(-yc)}) -- ({f(PAGE_W - 4)},{f(-yc)});")
        o.append(rf"\node[font=\tiny,text=black!50,fill=white,inner sep=1pt] at ({f(PAGE_W / 2)},{f(-yc)}) {{cortar}};")
    return "\n".join(o)


def pagina(fills=None):
    """fills: lista de 4 (resp, num) o None."""
    cuerpo = []
    for k in range(4):
        r, n = (fills[k] if fills else (None, None))
        import os
        cuerpo.append(tirilla(k, r, n, os.environ.get('RELLENO', 'black!85')))
    return (r"\begin{tikzpicture}[remember picture,overlay,x=1mm,y=1mm,shift={(current page.north west)}]" + "\n"
            + "\n".join(cuerpo) + "\n" + r"\end{tikzpicture}")


PREAMBULO = r"""\documentclass[12pt]{article}
\usepackage[paperwidth=216mm,paperheight=330mm,margin=0mm]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\IfFileExists{t1phv.fd}{\usepackage[scaled=0.95]{helvet}}{}
\renewcommand{\familydefault}{\sfdefault}
\usepackage{tikz}
\pagestyle{empty}
\begin{document}
\null
"""

if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--snippet":
        open(a[1], "w", encoding="utf8").write(pagina())
        sys.exit()
    out = a[0]
    fills = None
    if len(a) >= 3:
        fills = [(a[1], int(a[2]))] * 4
        if len(a) >= 5:
            fills = [(a[1], int(a[2])), (a[3], int(a[4]))] * 2
    open(out, "w", encoding="utf8").write(PREAMBULO + pagina(fills) + "\n\\end{document}\n")
