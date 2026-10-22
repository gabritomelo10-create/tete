"""Gera a trama Noël Sucré (img/losangos*.svg).

A trama é uma rede triangular: em cada aresta há um losango de 60° deitado ao longo dela.
Arestas verticais viram losangos em pé; as de ±30° viram losangos inclinados de lados horizontais,
formando as estrelas de seis pontas das embalagens. Uso: python3 scripts/gerar-trama.py
"""
import math

D = 60.0                      # distância entre pontos vizinhos da rede
COL = D * math.cos(math.radians(30))
W, H = 2 * COL, D             # o ladrilho repete a cada duas colunas
LONGO = 0.56 * D              # diagonal maior do losango
CURTO = LONGO * math.tan(math.radians(30))


def losango(cx, cy, angulo):
    a = math.radians(angulo)
    ux, uy = math.cos(a), -math.sin(a)
    vx, vy = -uy, ux
    p = [(cx + ux * LONGO / 2, cy + uy * LONGO / 2), (cx + vx * CURTO / 2, cy + vy * CURTO / 2),
         (cx - ux * LONGO / 2, cy - uy * LONGO / 2), (cx - vx * CURTO / 2, cy - vy * CURTO / 2)]
    return 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in p) + 'Z'


def pontos():
    for i in range(-2, 5):
        for j in range(-2, 4):
            yield i * COL, j * D + (D / 2 if i % 2 else 0)


caminhos = []
for x, y in pontos():
    for angulo in (90, 30, -30):
        a = math.radians(angulo)
        mx, my = x + math.cos(a) * D / 2, y - math.sin(a) * D / 2
        if -LONGO < mx < W + LONGO and -LONGO < my < H + LONGO:
            caminhos.append(losango(mx, my, angulo))
d = ' '.join(caminhos)


def svg(cor, opacidade, espessura):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.2f}" height="{H:.0f}" viewBox="0 0 {W:.2f} {H:.0f}">'
            f'<path d="{d}" fill="none" stroke="{cor}" stroke-opacity="{opacidade}" stroke-width="{espessura}" '
            f'stroke-linejoin="round"/></svg>\n')


open('img/losangos.svg', 'w').write(svg('#E2B877', .9, 1.4))
open('img/losangos-relevo.svg', 'w').write(svg('#B8925A', .35, 1.2))
print(f'ladrilho {W:.2f} x {H:.0f}')
