let database;
export function db() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('ke-chuyen-library', 2);
    request.onupgradeneeded = () => {
      if(!request.result.objectStoreNames.contains('books'))request.result.createObjectStore('books', {keyPath:'id'});
      if(!request.result.objectStoreNames.contains('tracks'))request.result.createObjectStore('tracks', {keyPath:'key'}).createIndex('bookId','bookId');
    };
    request.onsuccess = () => {request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror = () => reject(request.error);
  });
}
export async function storedTracks(bookId) {
  const database=await db();
  return new Promise((resolve,reject)=>{const request=database.transaction('tracks').objectStore('tracks').index('bookId').getAll(bookId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function saveTrack(track) {
  const database=await db();
  return new Promise((resolve,reject)=>{const transaction=database.transaction('tracks','readwrite');transaction.objectStore('tracks').put(track);transaction.oncomplete=resolve;transaction.onerror=transaction.onabort=()=>reject(transaction.error);});
}
export async function storedBooks() {
  const database = await db();
  return new Promise((resolve,reject) => {
    const request = database.transaction('books').objectStore('books').getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function saveBook(book) {
  const database = await db();
  return new Promise((resolve,reject) => {
    const transaction = database.transaction('books','readwrite');
    transaction.objectStore('books').put(book);
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Không lưu được truyện.'));
  });
}
export function validateChapters(chapters) {
  if (!Array.isArray(chapters) || !chapters.length) throw new Error('File chưa có chương truyện.');
  const numbers = new Set();
  return chapters.map((chapter,index) => {
    const number = Number(chapter.number ?? index + 1);
    if (!Number.isSafeInteger(number) || number < 1 || numbers.has(number)) throw new Error('Số chương phải là số nguyên dương và không trùng nhau trong file.');
    numbers.add(number);
    if (typeof chapter.text !== 'string' || !chapter.text.trim()) throw new Error(`Chương ${number} chưa có nội dung chữ.`);
    return {number, title:String(chapter.title || `Chương ${number}`).slice(0,250), text:chapter.text.trim(), words:chapter.text.trim().split(/\s+/).length};
  });
}
export function parseText(text, fileName, fallbackNumber) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g,'\n').trim();
  if (!text) throw new Error(`File ${fileName} không có nội dung.`);
  const headings = [...text.matchAll(/^(?:Chương|Chuong|Chapter|Tập|Tap)\s+(\d+)\b[^\n]*/gimu)];
  if (!headings.length) {
    const match = fileName.match(/(?:^|\D)(\d+)/);
    return [{number:match ? +match[1] : fallbackNumber, title:fileName.replace(/\.txt$/i,''), text}];
  }
  return headings.map((heading,index) => ({number:+heading[1], title:heading[0].trim(), text:text.slice(heading.index, headings[index+1]?.index ?? text.length).trim()}));
}
