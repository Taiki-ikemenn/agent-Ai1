/* ===== AIに見せられるファイル（Word・Excel・PowerPoint・ZIPなども中身を取り出す） ===== */
const FILE_KINDS=[
  ['image','画像','JPG・PNG・WebP・HEIC・GIF（1枚目）・BMP・TIFF・SVG'],
  ['file-text','文書','PDF・Word（.docx）・PowerPoint（.pptx）・OpenDocument（.odt / .odp）・EPUB・RTF'],
  ['sheet','表','Excel（.xlsx）・OpenDocument（.ods）・CSV・TSV'],
  ['file-code','テキスト・コード','TXT・Markdown・JSON・HTML・CSS・JS・Python など、文字のファイルならほぼ全部'],
  ['music','音声','MP3・WAV・M4A・AAC・OGG・FLAC・AIFF（長いものは自動で軽くします）'],
  ['film','動画','MP4・MOV・WebM・MPEG・AVI など（15MBまで）'],
  ['folder-archive','まとめたファイル','ZIP（中の文字のファイルを読みます）']];
function showFileKinds(){ modal((m,close)=>{ m.append(h('h3',null,'AIに見せられるファイル'),h('p',{class:'muted',style:'margin:0 0 10px;font-size:13px'},'クリップのボタン・ドラッグ・貼り付けで追加できます。1つ15MBまで。'));
  FILE_KINDS.forEach(([i,t,d])=>m.append(h('div',{class:'memItem',html:`<div style="width:34px;height:34px;border-radius:10px;background:var(--accSoft);color:var(--acc);display:grid;place-items:center;flex:none">${ic(i)}</div><div class="mt"><b>${t}</b><div class="muted" style="font-size:13px;line-height:1.6">${d}</div></div>`})));
  m.append(h('p',{class:'help',style:'margin-top:10px'},'古い形式（.doc / .xls / .ppt）や、パスワード付きのファイルは読めません。PDFやWordで保存し直すと読めます。'),h('div',{class:'modalFoot'},h('button',{class:'btn pri',onclick:close},'OK'))); }); }
/* ---- ZIPを開く（ブラウザの展開機能を使用） ---- */
async function unzip(buf){ const v=new DataView(buf), u8=new Uint8Array(buf); let e=-1; for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--){ if(v.getUint32(i,true)===0x06054b50){ e=i; break; } } if(e<0) throw new Error('ZIPとして読めません');
  const n=v.getUint16(e+10,true); let p=v.getUint32(e+16,true); const files={}; const dec=new TextDecoder();
  for(let k=0;k<n;k++){ if(v.getUint32(p,true)!==0x02014b50) break; const method=v.getUint16(p+10,true), csize=v.getUint32(p+20,true), nl=v.getUint16(p+28,true), xl=v.getUint16(p+30,true), cl=v.getUint16(p+32,true), off=v.getUint32(p+42,true); const name=dec.decode(u8.subarray(p+46,p+46+nl)); p+=46+nl+xl+cl;
    if(name.endsWith('/')) continue; files[name]={size:v.getUint32(p-nl-xl-cl-46+24,true),read:async()=>{ const lnl=v.getUint16(off+26,true), lxl=v.getUint16(off+28,true); const data=u8.subarray(off+30+lnl+lxl,off+30+lnl+lxl+csize); if(method===0) return data; if(method!==8) throw new Error('この圧縮形式は読めません'); const ds=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(ds).arrayBuffer()); },text:async function(){ return new TextDecoder().decode(await this.read()); }}; }
  return files; }
const xmlText=s=>s.replace(/<\/(w:p|a:p|text:p|text:h|p|div|h\d|li|tr)>/g,'\n').replace(/<(w:tab|text:tab)\/>/g,'\t').replace(/<(w:br|text:line-break|br)\s*\/?>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,c)=>String.fromCharCode(c)).replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n').trim();
const natural=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
async function officeText(file){ const ext=(file.name.split('.').pop()||'').toLowerCase(); const z=await unzip(await file.arrayBuffer()); const names=Object.keys(z);
  if(ext==='docx') return xmlText(await z['word/document.xml'].text());
  if(ext==='pptx'){ const sl=names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(natural); let out=''; for(let i=0;i<sl.length;i++) out+=`--- スライド${i+1} ---\n`+xmlText(await z[sl[i]].text())+'\n\n'; const nt=names.filter(n=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).sort(natural); if(nt.length){ out+='=== ノート ===\n'; for(const n of nt) out+=xmlText(await z[n].text())+'\n'; } return out; }
  if(ext==='xlsx'){ const ss=z['xl/sharedStrings.xml']?[...(await z['xl/sharedStrings.xml'].text()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>xmlText(m[1])):[]; const wb=z['xl/workbook.xml']?await z['xl/workbook.xml'].text():''; const sheetNames=[...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m=>m[1]);
    const sh=names.filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(natural); let out=''; const col=r=>{ let c=0; for(const ch of r.replace(/\d+/g,'')) c=c*26+ch.charCodeAt(0)-64; return c-1; };
    for(let i=0;i<sh.length;i++){ const x=await z[sh[i]].text(); out+=`=== シート：${sheetNames[i]||i+1} ===\n`; let rows=0; for(const rm of x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){ if(++rows>3000){ out+='…（長いので途中まで）\n'; break; } const cells=[]; for(const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){ const at=cm[1], body=cm[2]||''; const r=(at.match(/r="([A-Z]+\d+)"/)||[])[1]; const t=(at.match(/t="(\w+)"/)||[])[1]; let val=(body.match(/<v>([\s\S]*?)<\/v>/)||[])[1]||''; if(t==='s') val=ss[+val]||''; else if(t==='inlineStr') val=xmlText(body); else val=xmlText(val); const ci=r?col(r):cells.length; cells[ci]=/[",\n]/.test(val)?'"'+val.replace(/"/g,'""')+'"':val; } out+=Array.from(cells,c=>c??'').join(',')+'\n'; } out+='\n'; } return out; }
  if(/^od[tsp]$/.test(ext)) return xmlText((await z['content.xml'].text()).replace(/<\/table:table-cell>/g,'\t').replace(/<\/table:table-row>/g,'\n'));
  if(ext==='epub'){ const hs=names.filter(n=>/\.x?html?$/.test(n)).sort(natural); let out=''; for(const n of hs){ out+=xmlText((await z[n].text()).replace(/<head[\s\S]*?<\/head>/,''))+'\n\n'; if(out.length>300000) break; } return out; }
  if(ext==='zip'){ let out='ZIPの中身：\n'+names.map(n=>'- '+n+'（'+fmtSize(z[n].size||0)+'）').join('\n')+'\n\n'; for(const n of names){ if(!TEXT_EXT.test(n)||out.length>250000) continue; try{ out+=`=== ${n} ===\n`+(await z[n].text()).slice(0,60000)+'\n\n'; }catch(e){} } return out; }
  throw new Error('読めない形式です'); }
const rtfText=s=>s.replace(/\\par[d]?/g,'\n').replace(/\{\\\*[^{}]*\}/g,'').replace(/\\'([0-9a-f]{2})/gi,(m,h2)=>String.fromCharCode(parseInt(h2,16))).replace(/\\[a-z]+-?\d* ?/gi,'').replace(/[{}]/g,'').trim();
function looksText(u8){ let bad=0; const n=Math.min(u8.length,4096); for(let i=0;i<n;i++){ const c=u8[i]; if(c===0) return false; if(c<9||(c>13&&c<32)) bad++; } return bad<n*.02; }
// 音声：Geminiが直接読めない形式や大きいものは、16kHzモノラルのWAVにして軽くする
async function audioToWav(file){ const AC=window.AudioContext||window.webkitAudioContext; const ctx=new AC(); try{ const buf=await ctx.decodeAudioData(await file.arrayBuffer()); const sr=16000, len=Math.ceil(buf.duration*sr); const off=new OfflineAudioContext(1,len,sr); const s=off.createBufferSource(); s.buffer=buf; s.connect(off.destination); s.start(); return wavBlob(await off.startRendering()); } finally{ try{ ctx.close(); }catch(e){} } }
