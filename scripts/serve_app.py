"""Local preview + free recording generation + HTTP byte ranges for seeking."""
import concurrent.futures, json, mimetypes, re, threading, uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from generate_audio import ROOT, generate

jobs = {}
lock = threading.Lock()
pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)

def run_job(job_id, data):
    try:
        jobs[job_id]['status'] = 'working'
        track = generate(data['bookId'], data['number'], data['title'], data['text'])
        jobs[job_id].update(status='done', track=track)
    except Exception as error:
        jobs[job_id].update(status='error', message='Chưa tạo được bản thu. Kiểm tra Internet và thử lại. ' + type(error).__name__)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)

    def send_json(self, data, status=200):
        body=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/recordings': return self.send_json({'error':'Không tìm thấy.'},404)
        origin=self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self.send_json({'error':'Nguồn yêu cầu không hợp lệ.'},403)
        if self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            return self.send_json({'error':'Cần nội dung JSON.'},415)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 700000: raise ValueError()
            data=json.loads(self.rfile.read(length))
            if not re.fullmatch(r'[a-z0-9-]{1,100}',data['bookId']):raise ValueError()
            if type(data['number']) is not int or not 1 <= data['number'] <= 1000000:raise ValueError()
            if not isinstance(data['title'],str) or len(data['title'])>300:raise ValueError()
            if not isinstance(data['text'],str) or not 3 <= len(data['text'])<=150000:raise ValueError()
        except (ValueError,KeyError,TypeError):return self.send_json({'error':'Thông tin chương không hợp lệ.'},400)
        with lock:
            for job_id, job in jobs.items():
                if job['bookId']==data['bookId'] and job['number']==data['number'] and job['status'] in ('queued','working'):
                    return self.send_json({'jobId':job_id},202)
            if sum(job['status'] in ('queued','working') for job in jobs.values())>=3:
                return self.send_json({'error':'Đang có bản thu được tạo. Hãy chờ hoàn tất.'},429)
            job_id=uuid.uuid4().hex
            jobs[job_id]={'status':'queued','bookId':data['bookId'],'number':data['number']}
            pool.submit(run_job,job_id,data)
        self.send_json({'jobId':job_id},202)

    def do_GET(self):
        if self.path=='/api/capabilities':return self.send_json({'recordings':True,'voice':'Nam Minh · Giọng AI'})
        match=re.fullmatch(r'/api/jobs/([a-f0-9]{32})',self.path)
        if match:return self.send_json(jobs.get(match[1],{'error':'Không tìm thấy tác vụ.'}),200 if match[1] in jobs else 404)
        path=self.translate_path(self.path)
        if urlparse(self.path).path.endswith('.mp3'):
            try:
                stream=open(path,'rb')
            except OSError:return self.send_error(404)
            with stream:
                size=stream.seek(0,2);stream.seek(0)
                header=self.headers.get('Range')
                match=re.fullmatch(r'bytes=(\d*)-(\d*)',header or '')
                start,end=0,size-1
                if header:
                    if not match or not any(match.groups()):return self.send_error(416)
                    if match[1]:start=int(match[1]);end=min(int(match[2]),size-1) if match[2] else size-1
                    else:start=max(0,size-int(match[2]))
                    if start>end or start>=size:
                        self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
                self.send_response(206 if match else 200)
                self.send_header('Content-Type','audio/mpeg');self.send_header('Accept-Ranges','bytes')
                self.send_header('Content-Length',str(end-start+1))
                if match:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
                self.end_headers();stream.seek(start);remaining=end-start+1
                try:
                    while remaining:
                        chunk=stream.read(min(65536,remaining))
                        if not chunk:break
                        self.wfile.write(chunk);remaining-=len(chunk)
                except (BrokenPipeError,ConnectionResetError):pass
            return
        super().do_GET()

if __name__=='__main__':
    print('App: http://localhost:4173 (recording service ready)',flush=True)
    ThreadingHTTPServer(('0.0.0.0',4173),Handler).serve_forever()
