import json
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'dist'
catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
errors = []
for row in catalog:
    file = root / 'chapters' / f'{row["number"]}.json'
    if not file.exists():
        errors.append(row['number']); continue
    data = json.loads(file.read_text(encoding='utf-8'))
    assert data['number'] == row['number'] and len(data['text']) >= 300, file
assert len({r['number'] for r in catalog}) == len(catalog)
print(f'Catalog: {len(catalog)}; readable: {len(catalog)-len(errors)}; missing: {errors}')
