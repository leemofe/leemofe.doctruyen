import {storedBooks,saveBook,parseText,validateChapters} from './book-store.js';
const $ = id => document.getElementById(id);
let books=[], editingId=null, handlers;
function showError(message) { $('book-form-error').textContent=message; $('book-form-error').hidden=false; }
function renderBooks() {
  const query=$('book-search').value.trim().toLocaleLowerCase('vi');
  $('book-count').textContent=`(${books.length})`;
  $('book-list').replaceChildren();
  for(const book of books.filter(b=>b.title.toLocaleLowerCase('vi').includes(query))) {
    const card=document.createElement('article'); card.className='book-card';
    const cover=document.createElement('button');cover.className='book-cover';cover.setAttribute('aria-label',`Mở ${book.title}`);
    const label=document.createElement('span');label.className='cover-label';label.textContent='ĐỌC & NGHE';
    const title=document.createElement('strong');title.textContent=book.title;
    const stamp=document.createElement('span');stamp.className='cover-stamp';stamp.textContent='✦';
    cover.append(label,title,stamp);cover.onclick=()=>open(book);
    const heading=document.createElement('h3');heading.textContent=book.title;
    const detail=document.createElement('p');detail.textContent=book.catalog?(book.catalogSummary||'Thư viện chữ'):book.chapters?.length?`${book.chapters.length} chương · Lưu trên thiết bị`:(book.author?book.author+' · ':'')+(book.source?'Đã lưu link · Chưa nhập chương':'Chưa có chương · Sẵn sàng cập nhật');
    const actions=document.createElement('div');actions.className='book-actions';
    const read=document.createElement('button');read.className='primary';read.textContent=book.catalog||book.chapters?.length?'Đọc & nghe →':'Mở thông tin →';read.onclick=()=>open(book);
    const update=document.createElement('button');update.className='text-btn';update.textContent='Cập nhật';update.setAttribute('aria-label',`Cập nhật ${book.title}`);update.onclick=()=>showBookForm(book.id);
    actions.append(read,update);
    if(book.source){const source=document.createElement('a');source.href=book.source;source.target='_blank';source.rel='noopener';source.className='text-btn book-source';source.textContent='Mở nguồn ↗';source.setAttribute('aria-label',`Mở nguồn ${book.title}`);actions.append(source);}
    if(book.chapters?.length){const backup=document.createElement('button');backup.className='text-btn';backup.textContent=book.catalog?'Sao lưu chương bổ sung':'Sao lưu';backup.onclick=()=>{
      const blob=new Blob([JSON.stringify({title:book.title,source:book.source||'',chapters:book.chapters},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=book.title.replace(/[\\/:*?"<>|]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    };actions.append(backup);}
    card.append(cover,heading,detail,actions);$('book-list').append(card);
  }
  if(!$('book-list').children.length){const p=document.createElement('p');p.className='empty';p.textContent='Không tìm thấy tên truyện phù hợp.';$('book-list').append(p);}
}
async function open(book){
  $('shelf-view').hidden=true;$('book-view').hidden=false;document.body.classList.remove('shelf-mode');
  window.scrollTo({top:0,behavior:'instant'});
  try{await handlers.onOpen(book);}catch(error){$('chapter-title').textContent='Chưa mở được truyện';$('content').textContent=error.message;}
}
export function goToShelf(){handlers.onHome();$('book-view').hidden=true;$('shelf-view').hidden=false;document.body.classList.add('shelf-mode');document.title='Tủ truyện · Đọc & Nghe';renderBooks();window.scrollTo({top:0,behavior:'instant'});}
export function showBookForm(id=null){
  editingId=id;const book=books.find(b=>b.id===id);
  $('book-form').reset();$('book-form-error').hidden=true;
  $('book-dialog-title').textContent=book?'Cập nhật truyện':'Thêm truyện';
  $('new-book-title').value=book?.title||'';$('new-book-source').value=book?.source||'';
  $('update-book-note').hidden=!book;
  $('book-dialog').showModal();$('new-book-title').focus();
}
async function submitBook(event){
  event.preventDefault();$('book-form-error').hidden=true;
  const button=$('save-book');button.disabled=true;button.textContent='Đang lưu…';
  try {
    const title=$('new-book-title').value.trim();if(!title)throw new Error('Bạn hãy nhập tên truyện.');
    const existing=books.find(b=>b.id===editingId);
    const files=[...$('book-files').files];
    if(files.reduce((sum,file)=>sum+file.size,0)>50*1024*1024)throw new Error('Mỗi lần cập nhật tối đa 50 MB. Hãy chia nhỏ file.');
    let imported=[],fallback=(Math.max(existing?.lastNumber||0,...(existing?.chapters||[]).map(c=>c.number))+1);
    for(const file of files){
      const text=await file.text();let entries;
      if(/\.json$/i.test(file.name)){
        let data;try{data=JSON.parse(text);}catch{throw new Error(`File ${file.name} chưa đúng định dạng JSON.`);}
        entries=Array.isArray(data)?data:data.chapters;
        if(!Array.isArray(entries)&&data.text)entries=[data];
        entries=validateChapters(entries);
      }else if(/\.txt$/i.test(file.name))entries=validateChapters(parseText(text,file.name,fallback));
      else throw new Error('Hiện app nhận file TXT và JSON.');
      imported.push(...entries);fallback=Math.max(fallback,...entries.map(c=>c.number+1));
    }
    // Validate the complete incoming batch before changing the stored book.
    if(imported.length)imported=validateChapters(imported);
    const chapters=new Map((existing?.chapters||[]).map(c=>[c.number,c]));
    imported.forEach(chapter=>chapters.set(chapter.number,chapter));
    const source=$('new-book-source').value.trim();
    if(source&&!/^https?:\/\//i.test(source))throw new Error('Link nguồn cần bắt đầu bằng https:// hoặc http://.');
    const book={...existing,id:existing?.id||'book-'+crypto.randomUUID(),title,source,chapters:[...chapters.values()].sort((a,b)=>a.number-b.number)};
    await saveBook(book);
    const index=books.findIndex(b=>b.id===book.id);if(index<0)books.push(book);else books[index]=book;
    $('book-dialog').close();renderBooks();handlers.onSaved(book,imported.length);
  }catch(error){showError(error.name==='QuotaExceededError'?'Thiết bị không còn đủ dung lượng lưu truyện. Hãy sao lưu và thử file nhỏ hơn.':error.message||'Không lưu được truyện trên thiết bị này.');}
  finally{button.disabled=false;button.textContent='Lưu truyện';}
}
export async function initializeBooks(callbacks){
  handlers=callbacks;
  const response=await fetch('./books.json');if(!response.ok)throw new Error('Chưa tải được danh sách truyện.');
  const builtIn=await response.json();
  let local=[];try{local=await storedBooks();}catch{$('shelf-note')?.replaceChildren('Trình duyệt không mở được bộ nhớ truyện. Bạn vẫn đọc được truyện có sẵn; hãy dùng trình duyệt thông thường để thêm truyện.');}
  books=builtIn.map(b=>({...b,...local.find(x=>x.id===b.id)}));books.push(...local.filter(b=>!builtIn.some(x=>x.id===b.id)));
  renderBooks();
  $('add-book').onclick=()=>showBookForm();$('book-search').oninput=renderBooks;
  $('book-form').onsubmit=submitBook;$('close-book-dialog').onclick=()=>$('book-dialog').close();
  $('back-to-shelf').onclick=goToShelf;
  document.querySelector('.brand').onclick=event=>{event.preventDefault();goToShelf();};
}
