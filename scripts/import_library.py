"""Import the user-provided public Drive library into static JSON. Resumable."""
import concurrent.futures, io, json, re, time, urllib.request, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'chapters'
OUT.mkdir(parents=True, exist_ok=True)
sources = json.loads((ROOT / 'scripts/catalog.json').read_text(encoding='utf-8'))
# Prefer Word when the same numbered chapter is available in both formats.
chosen = {}
for f in sources:
    match = re.match(r'^(\d+)', f['title'])
    if not match: continue
    n = int(match[1])
    if n not in chosen or (f['title'].endswith('.docx') and not chosen[n]['title'].endswith('.docx')):
        chosen[n] = f

def load(item):
    n, f = item
    dest = OUT / f'{n}.json'
    if dest.exists():
        old = json.loads(dest.read_text(encoding='utf-8'))
        return {'number': n, 'title': old['title'], 'words': len(old['text'].split()), 'source': f['url']}
    error = None
    for attempt in range(3):
        try:
            url = 'https://drive.google.com/uc?export=download&id=' + f['id']
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=45) as response:
                data = response.read()
            if f['title'].endswith('.docx'):
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    tree = ET.fromstring(z.read('word/document.xml'))
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                lines = [''.join(t.text or '' for t in p.findall('.//w:t', ns)) for p in tree.findall('.//w:body//w:p', ns)]
                text = '\n\n'.join(line.strip() for line in lines if line.strip())
            else:
                if not data.startswith(b'%PDF'): raise ValueError('Drive returned no PDF')
                reader = PdfReader(io.BytesIO(data))
                lines = []
                for page in reader.pages:
                    lines.extend((page.extract_text() or '').splitlines())
                paragraphs, current = [], ''
                for line in lines:
                    line = re.sub(r'\s+', ' ', line).strip()
                    if not line or re.fullmatch(r'\d{1,3}', line): continue
                    if current and (re.search(r'[.!?…。”’!?][”’\"\']?$', current) or line.startswith(('“', '‘', '"', 'Chương '))):
                        paragraphs.append(current); current = ''
                    current += (' ' if current else '') + line
                if current: paragraphs.append(current)
                text = '\n\n'.join(paragraphs)
            text = text.replace('\x00', '').strip()
            if len(text) < 300: raise ValueError('Too little readable text')
            title = re.split(r'\n', text)[0].strip()
            if len(title) > 180 or not re.match(r'^(Chương|Chapter|Tập|\d)', title, re.I): title = f'Chương {n}'
            result = {'number': n, 'title': title, 'text': text, 'source': f['url']}
            dest.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
            return {'number': n, 'title': title, 'words': len(text.split()), 'source': f['url']}
        except Exception as exc:
            error = str(exc)
            time.sleep(attempt + 1)
    return {'number': n, 'title': f'Chương {n}', 'source': f['url'], 'error': error}

if __name__ == '__main__':
    catalog = []
    print(f'Importing {len(chosen)} chapters', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for record in pool.map(load, sorted(chosen.items())):
            catalog.append(record)
            if len(catalog) % 25 == 0:
                (ROOT / 'dist/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
                print(f'{len(catalog)}/{len(chosen)}; errors={sum("error" in x for x in catalog)}', flush=True)
    (ROOT / 'dist/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
    print(f'DONE: {len(catalog)} chapters, {sum("error" in x for x in catalog)} errors', flush=True)
