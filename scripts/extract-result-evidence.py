"""Extract result text and red-number evidence for visual review, never publish.

Usage: python scripts/extract-result-evidence.py source.pdf evidence.json
Requires pypdf and pdfplumber. Red numbers are review candidates, not inferred awards.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader
import pdfplumber


def is_red(color):
    if not isinstance(color, (list, tuple)):
        return False
    if len(color) == 4:
        cyan, magenta, yellow, black = color
        color = ((1-cyan)*(1-black), (1-magenta)*(1-black), (1-yellow)*(1-black))
    return len(color) == 3 and color[0] > .6 and color[1] < .4 and color[2] < .4


def extract(path):
    source = Path(path)
    if source.suffix.lower() != '.pdf' or source.read_bytes()[:5] != b'%PDF-':
        raise ValueError('Se necesita un PDF real.')
    reader = PdfReader(source)
    if reader.is_encrypted:
        raise ValueError('El PDF está cifrado.')
    pages = []
    with pdfplumber.open(source) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            headers = [w for w in words if w['text'].lower() == 'nombre']
            name_x = min((w['x0'] for w in headers), default=None)
            grouped = {}
            for char in page.chars:
                if char.get('upright') and char['text'].isdigit() and is_red(char.get('non_stroking_color')) and name_x is not None and char['x0'] < name_x:
                    grouped.setdefault(round(char['top']), []).append(char)
            signals = []
            for top, chars in sorted(grouped.items()):
                signals.append({'rank': ''.join(c['text'] for c in sorted(chars,key=lambda c:c['x0'])), 'top': top,
                                'rowText': ' '.join(w['text'] for w in words if abs(w['top']-top) < 4),
                                'needsVisualReview': True})
            pages.append({'page': number, 'text': reader.pages[number-1].extract_text() or '', 'redRankCandidates': signals, 'needsVisualReview': True})
    return {'sourceName': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'reviewed': False,
            'notice': 'Comprobar categorías, tiempos de referencia y números rojos visualmente. Excluir tablas y columnas del campeonato. No publicar ni calcular diferencias automáticamente.', 'pages': pages}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('output')
    args = parser.parse_args()
    if Path(args.pdf).resolve() == Path(args.output).resolve():
        raise ValueError('No sobrescribir el PDF original.')
    result = extract(args.pdf)
    with open(args.output, 'x', encoding='utf-8') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
