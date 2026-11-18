import {storedTracks,saveTrack} from './book-store.js';
const $=id=>document.getElementById(id);
export function formatTime(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
export function parseTime(value){const parts=value.trim().split(':');if(!parts.length||parts.length>3||parts.some(p=>!/^\d+$/.test(p)))return null;const numbers=parts.map(Number);if(parts.length>1&&numbers.at(-1)>59||parts.length===3&&numbers[1]>59)return null;return numbers.reduce((total,part)=>total*60+part,0);}
export function createAudioPlayer({toast,getText}){
  const audio=$('recording');let book=null,chapters=[],tracks=[],selected=null,sequence=0,restoring=false,progress={positions:{}},timer=null,deadline=0,lastSave=0,service=false;
  const pending=new Map();
  function persist(force=false){
    if(!book||!selected||restoring||!Number.isFinite(audio.currentTime))return;
    if(!force&&Date.now()-lastSave<1000)return;lastSave=Date.now();
    progress.last=selected.number;progress.positions[selected.number]=audio.currentTime;
    try{localStorage.setItem('ke-chuyen-audio-'+book.id,JSON.stringify(progress));}catch{}
  }
  function update(){
    const ready=selected&&Number.isFinite(audio.duration)&&audio.duration>0;
    $('audio-play').disabled=!selected;$('audio-play').textContent=audio.paused?'▶':'Ⅱ';$('audio-play').setAttribute('aria-label',audio.paused?'Phát bản thu':'Tạm dừng bản thu');
    $('audio-progress').disabled=!ready;$('audio-progress').max=ready?audio.duration:0;$('audio-progress').value=ready?audio.currentTime:0;
    $('audio-elapsed').textContent=formatTime(audio.currentTime);$('audio-duration').textContent=ready?formatTime(audio.duration):selected?.duration?formatTime(selected.duration):'--:--';
    $('audio-title').textContent=selected?.title||'Chưa có bản thu';$('audio-book-name').textContent=book?.title||'';
    $('audio-playing-badge').hidden=audio.paused;
    if(!selected)$('audio-status').textContent='Tạo bản thu hoặc thêm file âm thanh để bắt đầu nghe.';
    else if(!audio.paused)$('audio-status').textContent='Đang phát · '+(selected.voice||'Bản thu đã thêm');
    else if(ready)$('audio-status').textContent='Đã lưu vị trí nghe · '+(selected.voice||'Bản thu đã thêm');
    renderTrackSelection();
    if('mediaSession' in navigator){
      navigator.mediaSession.playbackState=selected?(audio.paused?'paused':'playing'):'none';
      if(ready)try{navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.currentTime,audio.duration)});}catch{}
    }
  }
  function renderTrackSelection(){document.querySelectorAll('.track-row').forEach(row=>{const active=+row.dataset.number===selected?.number;row.classList.toggle('selected',active);row.setAttribute('aria-current',active?'true':'false');});}
  function render(){
    $('audio-count').textContent=tracks.length+' bản';$('track-list').replaceChildren();
    for(const track of tracks){const row=document.createElement('button');row.className='track-row';row.dataset.number=track.number;
      const icon=document.createElement('span');icon.className='track-number';icon.textContent=String(track.number).padStart(3,'0');
      const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=track.title;
      const detail=document.createElement('small');detail.textContent=(track.duration?formatTime(track.duration)+' · ':'')+(track.voice||'File trên thiết bị');copy.append(title,detail);row.append(icon,copy);row.onclick=()=>select(track,false);$('track-list').append(row);
    }
    if(!tracks.length){const p=document.createElement('p');p.className='empty';p.textContent='Truyện này chưa có bản thu âm. Phần chữ vẫn đọc bình thường.';$('track-list').append(p);}
    renderTrackSelection();
  }
  function select(track,autoplay=false){
    persist(true);restoring=true;audio.pause();selected=track;
    $('audio-status').textContent='Đang mở bản thu…';audio.src=track.url;audio.load();
    if('mediaSession' in navigator&&'MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.voice||'Bản thu',album:book.title});
    update();if(autoplay)play();
  }
  async function play(){if(!selected)return;try{if(navigator.audioSession)navigator.audioSession.type='playback';await audio.play();}catch{$('audio-status').textContent='Bấm Phát để tiếp tục, hoặc kiểm tra file và kết nối.';update();}}
  function seek(seconds){if(!selected||!Number.isFinite(audio.duration))return;audio.currentTime=Math.max(0,Math.min(seconds,audio.duration));persist(true);update();}
  function expire(){if(!deadline||Date.now()<deadline)return;deadline=0;clearTimeout(timer);audio.pause();persist(true);$('audio-sleep').value='0';toast('Đã dừng bản thu theo hẹn giờ.');}
  audio.addEventListener('loadedmetadata',()=>{
    if(!selected)return;const saved=Number(progress.positions[selected.number])||0;
    if(Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(saved,Math.max(0,audio.duration-.1)));
    restoring=false;persist(true);update();
  });
  audio.addEventListener('timeupdate',()=>{expire();persist();update();});
  audio.addEventListener('play',()=>{update();});audio.addEventListener('pause',()=>{persist(true);update();});
  audio.addEventListener('ratechange',update);
  audio.addEventListener('error',()=>{restoring=false;$('audio-status').textContent='Không mở được bản thu. Kiểm tra Internet hoặc thêm lại file.';update();});
  audio.addEventListener('ended',()=>{persist(true);if($('audio-autonext').checked){const next=tracks[tracks.findIndex(t=>t.number===selected?.number)+1];if(next){progress.positions[next.number]=0;select(next,true);return;}}update();});
  $('audio-play').onclick=()=>audio.paused?play():audio.pause();$('audio-back').onclick=()=>seek(audio.currentTime-15);$('audio-forward').onclick=()=>seek(audio.currentTime+15);
  $('audio-progress').oninput=()=>seek(+$('audio-progress').value);
  $('audio-speed').onchange=()=>{audio.playbackRate=+$('audio-speed').value;};
  $('jump-form').onsubmit=event=>{event.preventDefault();const target=parseTime($('jump-time').value);if(target===null)return toast('Nhập thời điểm dạng phút:giây, ví dụ 05:30.');if(!Number.isFinite(audio.duration))return toast('Hãy chọn và chờ bản thu tải xong.');if(target>audio.duration)return toast('Thời điểm vượt quá độ dài bản thu.');seek(target);};
  $('audio-sleep').onchange=()=>{clearTimeout(timer);const minutes=+$('audio-sleep').value;deadline=minutes?Date.now()+minutes*60000:0;if(minutes)timer=setTimeout(expire,minutes*60000);toast(minutes?`Hẹn dừng sau ${minutes} phút. Khi khóa máy, hẹn giờ có thể trễ tùy iOS.`:'Đã tắt hẹn giờ.');};
  if('mediaSession' in navigator){for(const [action,handler] of Object.entries({play,pause:()=>audio.pause(),seekbackward:detail=>seek(audio.currentTime-(detail.seekOffset||15)),seekforward:detail=>seek(audio.currentTime+(detail.seekOffset||15)),seekto:detail=>seek(detail.seekTime),previoustrack:()=>{const previous=tracks[tracks.findIndex(t=>t===selected)-1];if(previous)select(previous,true);},nexttrack:()=>{const next=tracks[tracks.findIndex(t=>t===selected)+1];if(next)select(next,true);}}))try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
  window.addEventListener('pagehide',()=>persist(true));document.addEventListener('visibilitychange',()=>{persist(true);expire();});
  $('add-recording').onclick=()=>{if(!book)return;$('recording-form').reset();$('recording-number').value=selected?.number||chapters[0]?.number||1;$('recording-name').value=chapters.find(c=>c.number===+$('recording-number').value)?.title||'Chương '+$('recording-number').value;$('recording-error').hidden=true;$('recording-dialog').showModal();};
  $('close-recording-dialog').onclick=()=>$('recording-dialog').close();
  $('recording-form').onsubmit=async event=>{
    event.preventDefault();const button=$('save-recording');button.disabled=true;
    const targetBook=book;try{
      const number=+$('recording-number').value,file=$('recording-file').files[0],title=$('recording-name').value.trim();
      if(!Number.isSafeInteger(number)||number<1||!file||!title)throw new Error('Hãy nhập số chương, tên và chọn file âm thanh.');
      if(!/\.(mp3|m4a)$/i.test(file.name))throw new Error('Chọn file MP3 hoặc M4A.');
      if(file.size>150*1024*1024)throw new Error('Mỗi bản thu tối đa 150 MB.');
      const candidate={key:targetBook.id+':'+number,bookId:targetBook.id,number,title,blob:file,voice:'Bản thu đã thêm'};
      await saveTrack(candidate);$('recording-dialog').close();if(book?.id===targetBook.id)await reloadTracks(number);toast('Đã lưu bản thu trên thiết bị này.');
    }catch(error){$('recording-error').textContent=error.name==='QuotaExceededError'?'Thiết bị không đủ dung lượng. Hãy dùng file nhỏ hơn.':error.message;$('recording-error').hidden=false;}finally{button.disabled=false;}
  };
  async function reloadTracks(preferred){
    const generation=sequence,targetBook=book;let hosted=[],local=[];
    const results=await Promise.allSettled([fetch(`./audio/${targetBook.id}/catalog.json`,{cache:'no-store'}).then(r=>r.ok?r.json():[]),storedTracks(targetBook.id)]);
    if(generation!==sequence)return;
    if(results[0].status==='fulfilled')hosted=results[0].value;if(results[1].status==='fulfilled')local=results[1].value;
    persist(true);restoring=true;audio.pause();audio.removeAttribute('src');audio.load();tracks.filter(t=>t.objectURL).forEach(t=>URL.revokeObjectURL(t.url));
    const merged=new Map(hosted.map(track=>[track.number,track]));local.forEach(track=>merged.set(track.number,{...track,url:URL.createObjectURL(track.blob),objectURL:true}));
    tracks=[...merged.values()].sort((a,b)=>a.number-b.number);selected=null;restoring=false;render();
    const first=tracks.find(t=>t.number===preferred)||tracks.find(t=>t.number===progress.last)||tracks[0];if(first)select(first);else update();
  }
  function showJob(){const job=pending.get(book?.id);$('generate-recording').disabled=!!job;$('generation-status').textContent=job?job.message:'';}
  async function generate(){
    if(!book)return;const targetBook=book,number=+$('generate-chapter').value;
    $('generate-recording').disabled=true;
    const status={message:`Đang tạo bản thu chương ${number}… Bạn có thể chuyển sang đọc chữ.`};pending.set(targetBook.id,status);showJob();
    try{
      const data=await getText(number);const response=await fetch('./api/recordings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookId:targetBook.id,number,title:data.title,text:data.text})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Chưa tạo được bản thu.');
      for(let attempts=0;attempts<600;attempts++){
        const stateResponse=await fetch('./api/jobs/'+result.jobId,{cache:'no-store'});if(!stateResponse.ok)throw new Error('Mất kết nối với máy tạo bản thu.');const state=await stateResponse.json();
        if(state.status==='done'){pending.delete(targetBook.id);if(book?.id===targetBook.id){await reloadTracks(number);showJob();}toast(`Bản thu chương ${number} đã sẵn sàng.`);return;}
        if(state.status==='error')throw new Error(state.message);
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      throw new Error('Chưa nhận được kết quả. Hãy kiểm tra lại danh sách bản thu sau.');
    }catch(error){pending.delete(targetBook.id);if(book?.id===targetBook.id){showJob();$('generation-status').textContent=error.message;}toast(error.message);}
  }
  $('generate-recording').onclick=generate;
  async function openBook(nextBook,nextChapters){
    stop();sequence++;book=nextBook;chapters=nextChapters;
    try{progress=JSON.parse(localStorage.getItem('ke-chuyen-audio-'+book.id)||'{"positions":{}}');}catch{progress={positions:{}};}progress.positions||={};
    $('generate-chapter').replaceChildren();chapters.filter(c=>!c.error).forEach(c=>$('generate-chapter').add(new Option(c.title,String(c.number))));
    $('generate-chapter').disabled=!$('generate-chapter').options.length;
    $('generate-recording').hidden=!service||!$('generate-chapter').options.length;
    showJob();await reloadTracks();
  }
  function stop(){persist(true);restoring=true;audio.pause();audio.removeAttribute('src');audio.load();selected=null;clearTimeout(timer);deadline=0;$('audio-sleep').value='0';update();}
  fetch('./api/capabilities').then(r=>r.ok?r.json():{}).then(capabilities=>{service=capabilities.recordings===true;$('generation-help').textContent=service?'Tạo MP3 bằng giọng nam Nam Minh (AI), cần Internet trên máy tính đang chạy app. Dịch vụ miễn phí có thể gián đoạn.':'Bạn có thể thêm MP3/M4A đã có. Tạo bản thu từ chữ cần mở app bằng CHAY-APP.bat trên máy tính.';if(book)$('generate-recording').hidden=!service||!$('generate-chapter').options.length;}).catch(()=>{});
  return {openBook,stop,save:()=>persist(true)};
}
