/* ===== エージェントAi : 基本の道具 ===== */
const VERSION='1.2.0';
const $=s=>document.querySelector(s);
function h(tag,attrs,...kids){ const e=document.createElement(tag); if(attrs) for(const k in attrs){ const v=attrs[k]; if(v==null||v===false) continue; if(k==='class') e.className=v; else if(k==='html') e.innerHTML=v; else if(k==='style'&&typeof v==='object') Object.assign(e.style,v); else if(k.startsWith('on')&&typeof v==='function') e[k]=v; else e.setAttribute(k,v===true?'':v); } for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(String(c))); } return e; }
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ic(n,cls=''){ const p=ICONS[n]||ICONS['circle']; return `<svg class="i ${cls}" viewBox="0 0 24 24">${p}</svg>`; }
function icn(n,cls){ const t=document.createElement('template'); t.innerHTML=ic(n,cls); return t.content.firstChild; }
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LS={ get(k,d){ try{ const v=localStorage.getItem('agentai_'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem('agentai_'+k,JSON.stringify(v)); }catch(e){} }, del(k){ localStorage.removeItem('agentai_'+k); } };
function ago(ms){ if(!ms) return ''; const s=(Date.now()-ms)/1000; if(s<60) return 'たった今'; if(s<3600) return Math.floor(s/60)+'分前'; if(s<86400) return Math.floor(s/3600)+'時間前'; if(s<86400*7) return Math.floor(s/86400)+'日前'; const d=new Date(ms); return `${d.getMonth()+1}/${d.getDate()}`; }
function fmtSize(n){ if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
function fmtDT(ms){ const d=new Date(ms); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

/* ---------- トースト ---------- */
function toast(msg,icon='info',ms=2600){ const t=h('div',{class:'toast',html:ic(icon)+'<span>'+esc(msg)+'</span>'}); $('#toasts').append(t); setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),300); },ms); }

/* ---------- モーダル ---------- */
function modal(build,{wide=false,onClose}={}){ const sc=h('div',{class:'scrim'}); const m=h('div',{class:'modal'+(wide?' wide':'')}); sc.append(m); const close=()=>{ sc.style.animation='fade .2s reverse forwards'; setTimeout(()=>sc.remove(),180); onClose&&onClose(); }; sc.onclick=e=>{ if(e.target===sc) close(); }; build(m,close); document.body.append(sc); return close; }
function confirmBox(title,text,okLabel='OK',danger=false){ return new Promise(res=>{ modal((m,close)=>{ m.append(h('h3',null,title),h('p',{class:'muted',style:'line-height:1.7;white-space:pre-wrap;max-height:50vh;overflow:auto;background:var(--panel2);border-radius:12px;padding:12px 14px'},text)); const f=h('div',{class:'modalFoot'}); f.append(h('button',{class:'btn ghost',onclick:()=>{ close(); res(false); }},'やめる'),h('button',{class:'btn '+(danger?'danger':'pri'),onclick:()=>{ close(); res(true); }},okLabel)); m.append(f); }); }); }

/* ---------- プルダウン ---------- */
let OPEN_DD=null; document.addEventListener('pointerdown',e=>{ if(OPEN_DD&&!OPEN_DD.contains(e.target)){ OPEN_DD.close(); } },true);
function dropdown({value,items,onChange,icon,right=false,label,width}){ // items: [{v,t,s,icon}] or 'sep'
  const d=h('div',{class:'dd'}); const b=h('button',{class:'ddBtn',type:'button'}); if(width) b.style.maxWidth=width;
  const cur=()=>items.find(i=>i!=='sep'&&i.v===value); const paint=()=>{ const c=cur(); b.innerHTML=(icon?ic(icon):(c&&c.icon?ic(c.icon):''))+`<span>${esc(label?label(c):(c?c.t:'選ぶ'))}</span>`+ic('chevron-down','chev'); };
  d.close=()=>{ d.classList.remove('open'); const m=d.querySelector('.ddMenu'); m&&m.remove(); if(OPEN_DD===d) OPEN_DD=null; };
  b.onclick=()=>{ if(d.classList.contains('open')){ d.close(); return; } OPEN_DD&&OPEN_DD.close(); d.classList.add('open'); OPEN_DD=d; const m=h('div',{class:'ddMenu'+(right?' right':'')});
    items.forEach(it=>{ if(it==='sep'){ m.append(h('div',{class:'ddSep'})); return; } const x=h('button',{class:'ddItem'+(it.v===value?' on':''),type:'button',html:(it.icon?ic(it.icon):'')+`<div>${esc(it.t)}${it.s?`<small>${esc(it.s)}</small>`:''}</div>`+ic('check','ck')}); x.onclick=()=>{ value=it.v; paint(); d.close(); onChange&&onChange(it.v,it); }; m.append(x); });
    d.append(m); };
  d.set=v=>{ value=v; paint(); }; paint(); if(label&&label(null)==='') d.classList.add('iconOnly'); d.append(b); return d; }
/* ---------- スライダー ---------- */
function slider({min=0,max=100,step=1,value,fmt=v=>v,onChange}){ const w=h('div',{class:'sl'}); const r=h('input',{type:'range',min,max,step,value}); const o=h('output',null,fmt(value)); const paint=()=>{ r.style.setProperty('--p',((r.value-min)/(max-min)*100)+'%'); o.textContent=fmt(+r.value); }; r.oninput=()=>{ paint(); }; r.onchange=()=>onChange&&onChange(+r.value); r.addEventListener('input',()=>onChange&&onChange(+r.value,true)); paint(); w.append(r,o); return w; }
/* ---------- トグル ---------- */
function toggle(v,onChange){ const t=h('button',{class:'tg'+(v?' on':''),type:'button','aria-pressed':v?'true':'false'}); t.onclick=()=>{ v=!v; t.classList.toggle('on',v); t.setAttribute('aria-pressed',v); onChange&&onChange(v); }; return t; }
/* ---------- セグメント ---------- */
function segmented(items,value,onChange){ const s=h('div',{class:'seg'}); const th=h('div',{class:'thumb'}); s.append(th); const bs=items.map(([v,t,i])=>{ const b=h('button',{type:'button',class:v===value?'on':'',html:(i?ic(i):'')+esc(t)}); b.onclick=()=>{ value=v; bs.forEach(x=>x.classList.toggle('on',x===b)); move(); onChange&&onChange(v); }; s.append(b); return b; });
  const move=()=>{ const b=bs.find(x=>x.classList.contains('on')); if(!b) return; th.style.left=b.offsetLeft+'px'; th.style.width=b.offsetWidth+'px'; }; requestAnimationFrame(()=>requestAnimationFrame(move)); new ResizeObserver(move).observe(s); return s; }
function setRow(title,sub,ctrl){ const r=h('div',{class:'setRow'}); r.append(h('div',{class:'t',html:`<b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}`}),ctrl); return r; }

/* ---------- コードの色づけ ---------- */
function hl(code,lang){ let s=esc(code); lang=(lang||'').toLowerCase();
  if(/^(html|xml|svg|vue)$/.test(lang)){ return s.replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span class="tk-c">$1</span>').replace(/(&lt;\/?)([\w-]+)/g,'$1<span class="tk-t">$2</span>').replace(/([\w-:]+)=(&quot;.*?&quot;)/g,'<span class="tk-a">$1</span>=<span class="tk-s">$2</span>'); }
  if(lang==='css') return s.replace(/(\/\*[\s\S]*?\*\/)/g,'<span class="tk-c">$1</span>').replace(/([\w-]+)(\s*:)/g,'<span class="tk-f">$1</span>$2').replace(/(#[0-9a-f]{3,8}\b|\b\d+(\.\d+)?(px|em|rem|%|s|ms|vh|vw)?\b)/gi,'<span class="tk-n">$1</span>');
  const KW='const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|def|elif|lambda|None|True|False|pass|with|as|yield|public|private|static|void|int|float|string|bool|struct|fn|mut|use|package|func|go|defer|echo';
  const re=new RegExp(`(\\/\\/[^\\n]*|#(?![0-9a-f]{3,6}\\b)[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;|\`[^\`]*\`)|\\b(${KW})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|([A-Za-z_$][\\w$]*)(?=\\()`,'g');
  return s.replace(re,(m,c,str,k,n,f)=>{ if(c){ if(c[0]==='#'&&!/^(py|python|sh|bash|shell|ruby|rb|yaml|yml|r)$/.test(lang)) return c; return `<span class="tk-c">${c}</span>`; } if(str) return `<span class="tk-s">${str}</span>`; if(k) return `<span class="tk-k">${k}</span>`; if(n) return `<span class="tk-n">${n}</span>`; if(f) return `<span class="tk-f">${f}</span>`; return m; }); }
const EXT={javascript:'js',js:'js',typescript:'ts',ts:'ts',python:'py',py:'py',html:'html',css:'css',json:'json',java:'java',c:'c',cpp:'cpp','c++':'cpp',csharp:'cs',cs:'cs',go:'go',rust:'rs',ruby:'rb',php:'php',swift:'swift',kotlin:'kt',sh:'sh',bash:'sh',shell:'sh',sql:'sql',yaml:'yml',yml:'yml',markdown:'md',md:'md',xml:'xml',svg:'svg',txt:'txt',text:'txt'};
function codeBlock(code,lang,name){ const box=h('div',{class:'code'}); const head=h('div',{class:'codeHead'}); head.append(h('span',null,name||lang||'code'),h('span',{class:'sp'}));
  const cp=h('button',{type:'button',html:ic('copy')+'コピー'}); cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(code); cp.innerHTML=ic('check')+'コピーしました'; }catch(e){ const t=h('textarea'); t.value=code; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); cp.innerHTML=ic('check')+'コピーしました'; } setTimeout(()=>cp.innerHTML=ic('copy')+'コピー',1600); };
  const dl=h('button',{type:'button',html:ic('download')+'保存'}); dl.onclick=()=>downloadText(code,name||('code.'+(EXT[(lang||'').toLowerCase()]||'txt')));
  head.append(cp,dl); if(/^(html|svg)$/i.test(lang||'')){ const pv=h('button',{type:'button',html:ic('eye')+'プレビュー'}); pv.onclick=()=>previewModal(name||(/svg/i.test(lang)?'image.svg':'index.html'),code); const ed=h('button',{type:'button',html:ic('code-xml')+'編集'}); ed.onclick=()=>openCodeWith([{name:name||'index.html',content:code}]); head.append(pv,ed); }
  const pre=h('pre',{html:hl(code,lang)}); box.append(head,pre); return box; }

/* ---------- マークダウン ---------- */
function mdInline(s){ s=esc(s);
  s=s.replace(/`([^`]+)`/g,(m,c)=>'<code>'+c+'</code>');
  s=s.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;border-radius:12px">');
  s=s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  s=s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>').replace(/~~([^~]+)~~/g,'<s>$1</s>');
  return s; }
function md(text){ const root=h('div',{class:'md'}); const lines=String(text||'').replace(/\r/g,'').split('\n'); let i=0, buf=[];
  const flushP=()=>{ if(buf.length){ root.append(h('p',{html:buf.map(mdInline).join('<br>')})); buf=[]; } };
  while(i<lines.length){ const l=lines[i];
    const fence=l.match(/^\s*```\s*([\w+#.-]*)\s*(?:\s+([\w./-]+))?\s*$/); if(fence){ flushP(); const lang=fence[1]; const nm=fence[2]; const code=[]; i++; while(i<lines.length&&!/^\s*```\s*$/.test(lines[i])){ code.push(lines[i]); i++; } i++; root.append(codeBlock(code.join('\n'),lang,nm)); continue; }
    const hd=l.match(/^(#{1,3})\s+(.*)/); if(hd){ flushP(); root.append(h('h'+hd[1].length,{html:mdInline(hd[2])})); i++; continue; }
    if(/^\s*(---|\*\*\*)\s*$/.test(l)){ flushP(); root.append(h('hr')); i++; continue; }
    if(/^\s*>/.test(l)){ flushP(); const q=[]; while(i<lines.length&&/^\s*>/.test(lines[i])){ q.push(lines[i].replace(/^\s*>\s?/,'')); i++; } root.append(h('blockquote',{html:q.map(mdInline).join('<br>')})); continue; }
    if(/^\s*\|.*\|\s*$/.test(l)&&i+1<lines.length&&/^\s*\|[\s:|-]+\|\s*$/.test(lines[i+1])){ flushP(); const row=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()); const th=row(l); i+=2; const t=h('table'); t.append(h('tr',{html:th.map(c=>'<th>'+mdInline(c)+'</th>').join('')})); while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])){ t.append(h('tr',{html:row(lines[i]).map(c=>'<td>'+mdInline(c)+'</td>').join('')})); i++; } root.append(t); continue; }
    const li=l.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/); if(li){ flushP(); const ordered=/\d/.test(li[2]); const list=h(ordered?'ol':'ul'); while(i<lines.length){ const m=lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)/); if(!m) break; const t=m[3].replace(/^\[( |x)\]\s*/i,(x,c)=>c.trim()?'☑ ':'☐ '); list.append(h('li',{html:mdInline(t)})); i++; } root.append(list); continue; }
    if(!l.trim()){ flushP(); i++; continue; }
    buf.push(l); i++; }
  flushP(); return root; }

/* ---------- ファイル ---------- */
function downloadBlob(blob,name){ const a=h('a',{href:URL.createObjectURL(blob),download:name}); document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },2000); }
function downloadText(text,name,mime){ downloadBlob(new Blob([text],{type:mime||guessMime(name)}),name); }
function guessMime(n){ const e=(n.split('.').pop()||'').toLowerCase(); return ({html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',json:'application/json',md:'text/markdown',csv:'text/csv',svg:'image/svg+xml',xml:'application/xml',txt:'text/plain',py:'text/x-python',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',mp3:'audio/mpeg',wav:'audio/wav',webm:'video/webm',mp4:'video/mp4',ics:'text/calendar'})[e]||'text/plain'; }
const fileIcon=n=>{ const e=(n.split('.').pop()||'').toLowerCase(); if(/png|jpe?g|webp|gif|svg/.test(e)) return 'image'; if(/mp3|wav|m4a|ogg/.test(e)) return 'music'; if(/webm|mp4|mov/.test(e)) return 'film'; if(/pdf/.test(e)) return 'file-text'; if(/html|css|js|ts|py|json|java|c|cpp|go|rs|rb|php|sh/.test(e)) return 'file-code'; if(/csv|xlsx/.test(e)) return 'sheet'; return 'file'; };
const b64ToBlob=(b64,type)=>{ const bin=atob(b64), a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type}); };
const blobToB64=b=>new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(',')[1]); r.readAsDataURL(b); });
const blobToDataURL=b=>new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.readAsDataURL(b); });
async function shrinkImage(blob,max=1280,q=.82){ try{ const bmp=await createImageBitmap(blob); const k=Math.min(1,max/Math.max(bmp.width,bmp.height)); const c=h('canvas',{width:Math.round(bmp.width*k),height:Math.round(bmp.height*k)}); c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); return await new Promise(ok=>c.toBlob(ok,'image/jpeg',q)); }catch(e){ return blob; } }

/* ---------- この端末だけの保存（IndexedDB） ---------- */
const IDB={ db:null, open(){ return this.db||(this.db=new Promise((ok,ng)=>{ const q=indexedDB.open('agentai',1); q.onupgradeneeded=()=>q.result.createObjectStore('kv'); q.onsuccess=()=>ok(q.result); q.onerror=()=>ng(q.error); })); },
  async get(k){ const db=await this.open(); return new Promise((ok,ng)=>{ const t=db.transaction('kv').objectStore('kv').get(k); t.onsuccess=()=>ok(t.result); t.onerror=()=>ng(t.error); }); },
  async set(k,v){ const db=await this.open(); return new Promise((ok,ng)=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=()=>ok(); t.onerror=()=>ng(t.error); }); },
  async del(k){ const db=await this.open(); return new Promise(ok=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete=()=>ok(); }); } };
