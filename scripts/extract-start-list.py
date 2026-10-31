"""Read-only extraction for ChatGPT review; never connects to a database.

Usage: python scripts/extract-start-list.py source.pdf extracted.json
Requires pypdf. Scans require visual transcription/OCR and must not be auto-published.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader


def extract(source):
    path = Path(source)
    if path.suffix.lower() != '.pdf' or path.read_bytes()[:5] != b'%PDF-':
        raise ValueError('El origen debe ser un PDF real, no una imagen de referencia.')
    reader = PdfReader(path)
    if reader.is_encrypted:
        raise ValueError('El PDF está cifrado; proporcionar una copia legible.')
    pages = []
    for number, page in enumerate(reader.pages, 1):
        text = page.extract_text(extraction_mode='layout') or ''
        pages.append({'page': number, 'text': text, 'needs_visual_review': True,
                      'needs_ocr': len(text.strip()) < 20})
    return {'sourceName': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'pages': pages, 'reviewed': False,
            'instructions': 'Revisar visualmente cada página. Separar pruebas y asociar con plantilla; no inferir datos ilegibles ni publicar automáticamente.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('output')
    args = parser.parse_args()
    if Path(args.pdf).resolve() == Path(args.output).resolve():
        raise ValueError('La salida no puede sobrescribir el PDF original.')
    extracted = extract(args.pdf)
    with open(args.output, 'x', encoding='utf-8') as output:
        json.dump(extracted, output, ensure_ascii=False, indent=2)
