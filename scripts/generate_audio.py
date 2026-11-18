"""Create durable MP3 recordings; generation uses edge-tts' online service."""
import argparse, asyncio, hashlib, json, re, threading
from pathlib import Path
import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'dist' / 'audio'
manifest_lock = threading.Lock()

async def synthesize(text, book_id, number, temporary):
    digest=hashlib.sha256(text.encode()).hexdigest()[:12]
    folder=ROOT/'tmp'/'audio-parts'/book_id/f'{number}-{digest}'
    folder.mkdir(parents=True,exist_ok=True)
    chunks=[]
    while text:
        cut=len(text) if len(text)<=1000 else text.rfind(' ',0,1000)
        if cut<1:cut=1000
        chunks.append(text[:cut]);text=text[cut:].strip()
    with temporary.open('wb') as output:
        for index, chunk in enumerate(chunks):
            part=folder/f'{index:04}.mp3'
            if not part.exists():
                for attempt in range(3):
                    try:
                        # Retry using the voice's default prosody if the tuned request fails.
                        options={'rate':'-8%','pitch':'-8Hz'} if attempt==0 else {}
                        await asyncio.wait_for(edge_tts.Communicate(chunk,'vi-VN-NamMinhNeural',**options).save(str(part)),timeout=90)
                        MP3(part)
                        break
                    except Exception:
                        part.unlink(missing_ok=True)
                        if attempt==2:raise
                        await asyncio.sleep(2)
            # Edge returns constant-bitrate raw MP3 frames, so frame concatenation is valid.
            output.write(part.read_bytes());output.flush()
            print(f'Chapter {number}: {index+1}/{len(chunks)} audio parts',flush=True)

def generate(book_id, number, title, text):
    if not re.fullmatch(r'[a-z0-9-]{1,100}', book_id) or not isinstance(number, int) or number < 1:
        raise ValueError('Truyện hoặc số chương không hợp lệ.')
    if not isinstance(text, str) or not 3 <= len(text) <= 150000:
        raise ValueError('Nội dung cần từ 3 đến 150.000 ký tự.')
    text=re.sub(r'\s+',' ',text).translate(str.maketrans({'‘':"'",'’':"'",'“':'"','”':'"'})).strip()
    folder = AUDIO / book_id
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'{number}.mp3'
    if not target.exists():
        temporary = folder / f'{number}.part.mp3'
        try:
            asyncio.run(synthesize(text,book_id,number,temporary))
            MP3(temporary)  # Reject incomplete/invalid output before publishing.
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    track = {'number':number,'title':title,'url':f'./audio/{book_id}/{number}.mp3','duration':round(MP3(target).info.length, 2),'voice':'Nam Minh · Giọng AI'}
    with manifest_lock:
        manifest = folder / 'catalog.json'
        rows = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
        rows = [row for row in rows if row['number'] != number] + [track]
        pending = folder / 'catalog.pending.json'
        pending.write_text(json.dumps(sorted(rows,key=lambda row:row['number']),ensure_ascii=False),encoding='utf-8')
        pending.replace(manifest)
    return track

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--chapter', type=int, required=True)
    args = parser.parse_args()
    data = json.loads((ROOT / 'dist' / 'chapters' / f'{args.chapter}.json').read_text(encoding='utf-8'))
    track = generate('hoa-son', args.chapter, data['title'], data['text'])
    print(json.dumps({'chapter':track['number'],'seconds':track['duration'],'file':track['url']}),flush=True)
