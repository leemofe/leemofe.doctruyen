import {initializeBooks,showBookForm} from './bookshelf.js';
import {createAudioPlayer} from './audio-player.js';
const $=id=>document.getElementById(id);
function storageKey(id){return id&&id!=='hoa-son'?'ke-chuyen-progress-'+id:'hoa-son-v1';}
function readSaved(id){try{return JSON.parse(localStorage.getItem(storageKey(id))||'{}');}catch{return {};}}
let saved=readSaved(),activeBook=null,bookGeneration=0,loadGeneration=0;
let catalog=[],current=null,mode='read',filter='all',visibleCount=60,restoringReading=false;
const settings={font:19,dark:false,...saved.settings};
try{Object.assign(settings,JSON.parse(localStorage.getItem('ke-chuyen-settings')||'{}'));}catch{}
const marks=new Set();let reading={};
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').hidden=true,6000);}
function persist(){try{localStorage.setItem('ke-chuyen-settings',JSON.stringify(settings));if(activeBook)localStorage.setItem(storageKey(activeBook.id),JSON.stringify({...saved,settings,marks:[...marks],reading,last:current?.number||saved.last}));}catch{}}
function remember(){
  if(!activeBook||!current||mode!=='read'||$('book-view').hidden||restoringReading||$('library').classList.contains('open'))return;
  const paragraphs=[...$('content').children],index=paragraphs.findIndex(p=>{const rect=p.getBoundingClientRect();return rect.bottom>125&&rect.top<innerHeight;});
  reading[current.number]=index>=0?{paragraph:index,top:paragraphs[index].getBoundingClientRect().top}:{y:window.scrollY};persist();
}
function restoreReading(){
  const number=current?.number,generation=loadGeneration,anchor=reading[number];restoringReading=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(generation!==loadGeneration||mode!=='read'||current?.number!==number){restoringReading=false;return;}
    let target=typeof anchor==='number'?anchor:anchor?.y||0;
    if(anchor&&typeof anchor==='object'&&Number.isInteger(anchor.paragraph)){
      const paragraph=$('content').children[anchor.paragraph];if(paragraph)target=window.scrollY+paragraph.getBoundingClientRect().top-anchor.top;
    }
    window.scrollTo({top:Math.max(0,target),behavior:'instant'});restoringReading=false;
  }));
}
function updateSettings(){document.body.classList.toggle('dark',settings.dark);document.documentElement.style.setProperty('--story-size',settings.font+'px');}
const recordings=createAudioPlayer({toast,getText:number=>getChapterText(number)});
function setMode(next){
  if(mode==='read')remember();else recordings.save();
  mode=next;$('reading-view').hidden=mode!=='read';$('listening-view').hidden=mode!=='listen';
  $('read-mode').classList.toggle('active',mode==='read');$('listen-mode').classList.toggle('active',mode==='listen');
  $('read-mode').setAttribute('aria-pressed',mode==='read');$('listen-mode').setAttribute('aria-pressed',mode==='listen');
  document.body.classList.toggle('listening-mode',mode==='listen');
  if(mode==='read'&&current)restoreReading();else window.scrollTo({top:0,behavior:'instant'});
}
$('read-mode').onclick=()=>setMode('read');$('listen-mode').onclick=()=>setMode('listen');
function renderList(){
  const query=$('search').value.trim().toLocaleLowerCase('vi'),range=$('range').value;
  const results=catalog.filter(c=>(filter!=='saved'||marks.has(c.number))&&(range==='all'||Math.floor(c.number/100)*100===+range)&&(!query||String(c.number).includes(query)||c.title.toLocaleLowerCase('vi').includes(query)));
  $('chapter-list').replaceChildren();
  for(const c of results.slice(0,visibleCount)){
    const button=document.createElement('button');button.className='chapter-row'+(current?.number===c.number?' selected':'');button.setAttribute('aria-current',current?.number===c.number?'true':'false');
    const number=document.createElement('span');number.className='chapter-number';number.textContent=String(c.number).padStart(3,'0');
    const copy=document.createElement('span');copy.className='row-copy';const title=document.createElement('strong');title.textContent=c.title.replace(/^(Chương|Chapter|Tập)\s*\d+[.:\s–-]*/i,'')||`Chương ${c.number}`;
    const subtitle=document.createElement('small');subtitle.textContent=c.error?'Chưa trích được chữ · Mở bản gốc':`${Math.max(1,Math.round((c.words||1000)/180))} phút đọc${reading[c.number]?' · Đang đọc':''}`;
    copy.append(title,subtitle);const mark=document.createElement('span');mark.className='row-mark';mark.textContent=marks.has(c.number)?'♥':'';button.append(number,copy,mark);
    button.onclick=()=>{remember();$('library').classList.remove('open');openChapter(c.number);};$('chapter-list').append(button);
  }
  if(!results.length){const p=document.createElement('p');p.className='empty';p.textContent=filter==='saved'?'Chưa đánh dấu chương nào. Bấm ♡ để lưu.':'Không tìm thấy chương phù hợp.';$('chapter-list').append(p);}
  $('more').hidden=visibleCount>=results.length;
}
async function getChapterText(number){
  const record=catalog.find(c=>c.number===number);if(!record||record.error)throw new Error('Chương này chưa có nội dung chữ để tạo bản thu.');
  if(typeof record.text==='string')return record;
  const response=await fetch(new URL(`chapters/${number}.json`,new URL(activeBook.catalog,location.href)));
  if(!response.ok)throw new Error('Không tải được nội dung chương.');return response.json();
}
async function openChapter(number){
  const record=catalog.find(c=>c.number===number);if(!record)return;
  remember();const generation=++loadGeneration;current=record;
  $('chapter-kicker').textContent=`${activeBook.title.toLocaleUpperCase('vi')} · CHƯƠNG ${number}`;
  $('chapter-title').textContent=record.title;$('content').textContent='Đang mở nội dung…';$('reading-meta').textContent='';
  $('bookmark').textContent=marks.has(number)?'♥':'♡';$('bookmark').setAttribute('aria-pressed',marks.has(number));
  const index=catalog.indexOf(record);$('prev').disabled=index===0;$('next').disabled=index===catalog.length-1;renderList();
  try{
    const data=await getChapterText(number);if(generation!==loadGeneration)return;
    $('content').replaceChildren();
    data.text.split(/\n\s*\n/).map(text=>text.replace(/\s+/g,' ').trim()).filter(Boolean).forEach(text=>{const p=document.createElement('p');p.textContent=text;$('content').append(p);});
    $('reading-meta').textContent=`${data.text.split(/\s+/).length.toLocaleString('vi')} từ · Tự cuộn để đọc`;$('chapter-title').textContent=data.title;
    persist();if(mode==='read')restoreReading();
  }catch(error){
    if(generation!==loadGeneration)return;
    const p=document.createElement('p');p.className='error-message';p.textContent=record.error?'Chương này chưa trích xuất được chữ tự động. Hãy mở bản gốc trên Drive để đọc.':'Không tải được chương. Hãy kiểm tra kết nối và thử lại.';
    const a=document.createElement('a');a.href=record.source||activeBook.source||'#';a.hidden=!(record.source||activeBook.source);a.target='_blank';a.rel='noopener';a.textContent='↗ Mở bản gốc';a.className='primary';
    const retry=document.createElement('button');retry.className='text-btn';retry.textContent='Thử lại';retry.onclick=()=>openChapter(number);$('content').replaceChildren(p,a,...(record.error?[]:[retry]));
  }
}
$('settings').onclick=()=>$('settings-dialog').showModal();
$('theme').onclick=()=>{settings.dark=!settings.dark;updateSettings();persist();};
$('font-down').onclick=()=>{settings.font=Math.max(15,settings.font-1);updateSettings();persist();};$('font-up').onclick=()=>{settings.font=Math.min(30,settings.font+1);updateSettings();persist();};
$('bookmark').onclick=()=>{if(!current)return;const n=current.number;if(marks.has(n))marks.delete(n);else marks.add(n);$('bookmark').textContent=marks.has(n)?'♥':'♡';$('bookmark').setAttribute('aria-pressed',marks.has(n));persist();renderList();};
$('search').oninput=()=>{visibleCount=60;renderList();};$('range').onchange=()=>{visibleCount=60;renderList();};
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;visibleCount=60;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));renderList();});
$('more').onclick=()=>{visibleCount+=60;renderList();};
$('prev').onclick=()=>{const chapter=catalog[catalog.indexOf(current)-1];if(chapter)openChapter(chapter.number);};$('next').onclick=()=>{const chapter=catalog[catalog.indexOf(current)+1];if(chapter)openChapter(chapter.number);};
$('mobile-library').onclick=()=>{remember();$('library').classList.toggle('open');if($('library').classList.contains('open'))$('library').scrollIntoView({behavior:'smooth',block:'start'});};
let scrollSave;
window.addEventListener('scroll',()=>{clearTimeout(scrollSave);scrollSave=setTimeout(remember,300);},{passive:true});
window.addEventListener('pagehide',remember);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')remember();});
async function openBook(book){
  remember();recordings.stop();loadGeneration++;const generation=++bookGeneration;
  activeBook=book;current=null;catalog=[];saved=readSaved(book.id);marks.clear();(saved.marks||[]).forEach(n=>marks.add(n));reading=saved.reading||{};
  document.title=book.title+' · Đọc & Nghe';$('book-title').textContent=book.title;$('book-name').textContent=book.title;$('book-description').textContent=book.description||'Mở một chương. Thả mình theo câu chuyện.';
  $('chapter-title').textContent='Đang mở truyện…';$('content').textContent='Đang tải mục lục…';$('reading-meta').textContent='';$('chapter-kicker').textContent=book.title.toLocaleUpperCase('vi');
  $('source-link').hidden=!book.source;if(book.source)$('source-link').href=book.source;
  $('search').value='';filter='all';visibleCount=60;$('library').classList.remove('open');
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
  mode='read';setMode('read');let base=[];
  if(book.catalog){const response=await fetch(book.catalog);if(!response.ok)throw new Error('Chưa tải được mục lục.');base=await response.json();}
  if(generation!==bookGeneration)return;
  const merged=new Map(base.map(c=>[c.number,c]));(book.chapters||[]).forEach(c=>merged.set(c.number,c));catalog=[...merged.values()].sort((a,b)=>a.number-b.number);
  $('chapter-count').textContent=`${catalog.length.toLocaleString('vi')} chương`;
  const unreadable=catalog.filter(c=>c.error).length;$('source-note').textContent=catalog.length?`Chương ${catalog[0].number}–${catalog.at(-1).number}${unreadable?' · '+unreadable+' bản chưa trích được chữ':''}`:'Chưa có chương · Bấm Cập nhật chương để bổ sung';
  $('range').replaceChildren(new Option('Mọi chương','all'));[...new Set(catalog.map(c=>Math.floor(c.number/100)*100))].forEach(n=>$('range').add(new Option(`${n}–${n+99}`,String(n))));renderList();
  const audioLoading=recordings.openBook(book,catalog).catch(()=>toast('Chưa mở được thư viện bản thu.'));
  if(catalog.length)await openChapter(catalog.some(c=>c.number===saved.last)?saved.last:catalog[0].number);
  else{
    $('chapter-title').textContent='Chưa có nội dung chữ trong app';$('content').replaceChildren();
    const note=document.createElement('p');note.className='error-message';note.textContent='Đã lưu tên và nguồn truyện. Chọn “Cập nhật chương” để nhập file TXT/JSON của bạn; link nguồn chưa tự đồng bộ nội dung.';$('content').append(note);
    if(book.source){const link=document.createElement('a');link.className='primary';link.href=book.source;link.target='_blank';link.rel='noopener';link.textContent='Mở trang truyện gốc ↗';$('content').append(link);}
    $('prev').disabled=true;$('next').disabled=true;
  }
  await audioLoading;
}
$('update-current-book').onclick=()=>{if(activeBook)showBookForm(activeBook.id);};
updateSettings();
try{await initializeBooks({onOpen:openBook,onHome:()=>{remember();recordings.stop();loadGeneration++;bookGeneration++;current=null;activeBook=null;},onSaved:(book,count)=>{toast(count?`Đã cập nhật ${count} chương cho “${book.title}”.`:`Đã lưu “${book.title}”.`);if(activeBook?.id===book.id)openBook(book).catch(error=>toast(error.message));}});}catch(error){$('book-list').textContent=error.message||'Chưa mở được tủ truyện.';}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
