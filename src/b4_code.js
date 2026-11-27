/* ===== コード（AIと一緒にプログラミング） ===== */
const CODE={id:'',name:'',files:[],active:'',logs:[],onChange:null};
const CODE_START=[{name:'index.html',content:`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>はじめてのアプリ</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>こんにちは</h1>
  <p>左のチャットで「〇〇を作って」と頼んでみてね。</p>
  <script src="main.js"><\/script>
</body>
</html>`},{name:'style.css',content:`body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f6f8fc;color:#131a2b}
h1{font-size:40px;margin:0}`},{name:'main.js',content:`console.log('動いています');`}];
const langOf=n=>({html:'html',htm:'html',css:'css',js:'javascript',mjs:'javascript',ts:'typescript',json:'json',py:'python',md:'markdown',svg:'svg',xml:'xml'})[(n.split('.').pop()||'').toLowerCase()]||'text';
let codeSaveT=0; function codeSave(){ clearTimeout(codeSaveT); codeSaveT=setTimeout(()=>{ if(CODE.id) DB.put('codeprojects',CODE.id,{name:CODE.name,files:CODE.files,active:CODE.active,updated:Date.now()}).catch(e=>toast('保存できませんでした','x')); },700); }
function codeSet(name,content){ const f=CODE.files.find(x=>x.name===name); if(f) f.content=content; else CODE.files.push({name,content}); codeSave(); CODE.onChange&&CODE.onChange(name); }
async function openCodeWith(files,name){ const id=uid(); await DB.put('codeprojects',id,{name:name||(files[0]&&files[0].name.replace(/\.\w+$/,''))||'新しいコード',files,active:files[0].name,updated:Date.now(),created:Date.now()},false); go('#/code/'+id); }
function buildPreview(){ const html=CODE.files.find(f=>f.name==='index.html')||CODE.files.find(f=>/\.html?$/.test(f.name)); const key='cv'+uid();
  const cap=`<script>(function(){const K='${key}';const P=(t,v)=>parent.postMessage({k:K,t,v},'*');const F=x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}};['log','info','warn','error'].forEach(m=>{const o=console[m];console[m]=(...a)=>{P(m,a.map(F).join(' '));o.apply(console,a)}});addEventListener('error',e=>P('error',e.message+' ('+(e.lineno||'')+'行目)'));addEventListener('unhandledrejection',e=>P('error',String(e.reason)));})();<\/script>`;
  let doc; if(html){ doc=html.content; doc=doc.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi,(m,href)=>{ const f=CODE.files.find(x=>x.name===href.replace(/^\.\//,'')); return f?`<style>\n${f.content}\n</style>`:m; });
    doc=doc.replace(/<script([^>]*)src=["']([^"']+\.m?js)["']([^>]*)><\/script>/gi,(m,a,src,b)=>{ const f=CODE.files.find(x=>x.name===src.replace(/^\.\//,'')); return f?`<script${a}${b}>\n${f.content.replace(/<\/script/gi,'<\\/script')}\n<\/script>`:m; });
    doc=/<head[^>]*>/i.test(doc)?doc.replace(/<head[^>]*>/i,x=>x+cap+appShim('code_'+CODE.id,{})):cap+appShim('code_'+CODE.id,{})+doc; }
  else { const js=CODE.files.filter(f=>/\.m?js$/.test(f.name)).map(f=>f.content).join('\n;\n'); const css=CODE.files.filter(f=>/\.css$/.test(f.name)).map(f=>f.content).join('\n'); doc=`<!DOCTYPE html><html><head><meta charset="utf-8">${cap}<style>body{font-family:system-ui;padding:16px}${css}</style></head><body><script>${js.replace(/<\/script/gi,'<\\/script')}<\/script></body></html>`; }
  return {doc,key}; }
/* ---------- コード画面のAIの道具 ---------- */
tool('code_list',{group:'code',icon:'folder-tree',label:()=>'ファイル一覧を見る',desc:'いまのコードプロジェクトのファイル一覧',run:async()=>({project:CODE.name,files:CODE.files.map(f=>({name:f.name,lines:f.content.split('\n').length}))})});
tool('code_read',{group:'code',icon:'file-code',label:a=>'読む：'+a.name,desc:'コードプロジェクトのファイルを読む',params:OBJ({name:T('string','ファイル名')},['name']),run:async a=>{ const f=CODE.files.find(x=>x.name===a.name); if(!f) throw new Error('ありません：'+a.name); return {name:f.name,content:f.content}; }});
tool('code_write',{group:'code',icon:'file-pen-line',label:a=>'書く：'+a.name,desc:'コードプロジェクトのファイルを作る・まるごと書きかえる。中身は省略せず全部書く。',params:OBJ({name:T('string','ファイル名（index.html, style.css, main.js など）'),content:T('string','ファイルの中身すべて')},['name','content']),run:async a=>{ codeSet(a.name,a.content); return {ok:true,lines:a.content.split('\n').length}; }});
tool('code_edit',{group:'code',icon:'replace',label:a=>'一部を直す：'+a.name,desc:'ファイルの一部だけを置きかえる（findは元の文字そのまま・1か所だけ）',params:OBJ({name:T('string','ファイル名'),find:T('string','置きかえる前の文字'),replace:T('string','置きかえた後の文字')},['name','find','replace']),run:async a=>{ const f=CODE.files.find(x=>x.name===a.name); if(!f) throw new Error('ありません'); const n=f.content.split(a.find).length-1; if(n!==1) throw new Error(n?'同じ文字が'+n+'か所あります。もっと長く指定してください':'見つかりません'); codeSet(a.name,f.content.replace(a.find,()=>a.replace)); return {ok:true}; }});
tool('code_delete',{group:'code',icon:'file-x',label:a=>'消す：'+a.name,desc:'ファイルを消す',params:OBJ({name:T('string','ファイル名')},['name']),run:async a=>{ CODE.files=CODE.files.filter(x=>x.name!==a.name); if(CODE.active===a.name) CODE.active=(CODE.files[0]||{}).name||''; codeSave(); CODE.onChange&&CODE.onChange(); return {ok:true}; }});
tool('code_run',{group:'code',icon:'play',label:()=>'動かしてたしかめる',desc:'プレビューで実行して、コンソールの出力とエラーを返す。書いたあとは必ずこれでたしかめる。',run:async()=>{ CODE.logs=[]; CODE.run&&CODE.run(); await sleep(2200); return {console:CODE.logs.slice(-40).map(l=>l.t+': '+l.v),errors:CODE.logs.filter(l=>l.t==='error').length}; }});
const CODE_SYS=`いまは「コード」画面。右側にエディタとプレビューがある。ユーザーの頼みに合わせて code_write / code_edit でファイルを作り、code_run で動作をたしかめ、エラーがあれば直す。ブラウザで動くHTML/CSS/JavaScriptを基本にする（外部ライブラリはCDNなら可）。変更が終わったら、何を作ったか・どう使うかを短く説明する。会話の中に長いコードは貼らなくてよい。`;

PAGES.code=async(pg,arg)=>{ topBar('コード',{icon:'code-xml'}); pg.style.overflow='hidden';
  if(!arg){ const qs=await FB.m.getDocs(FB.m.query(DB.col('codeprojects'),FB.m.orderBy('updated','desc'),FB.m.limit(30))).catch(()=>null); const list=qs?qs.docs.map(d=>({id:d.id,...d.data()})):[];
    const w=h('div',{class:'wrap'}); pg.append(w); w.append(h('div',{class:'pageHead',html:'<h2>コード</h2><p>AIと一緒にプログラムを作る場所です。左のチャットで頼むと、右のエディタにファイルが書かれて、その場で動かせます。</p>'}));
    const grid=h('div',{class:'cards'}); w.append(grid); const add=h('div',{class:'pcard add',html:`<div>${ic('plus')}<div style="margin-top:8px;font-weight:700">新しいコード</div></div>`}); add.onclick=()=>openCodeWith(CODE_START.map(f=>({...f})),'新しいコード'); grid.append(add);
    list.forEach((p,i)=>{ const c=h('div',{class:'pcard',style:`animation:pageIn .4s ${i*.04}s backwards`,html:`<div class="pic" style="background:#0f1524">${ic('code-xml')}</div><h4>${esc(p.name)}</h4><p>${esc((p.files||[]).map(f=>f.name).join('、'))}</p><div class="meta"><span>${ic('clock')}${ago(p.updated)}</span><span>${ic('file')}${(p.files||[]).length}ファイル</span></div>`}); c.onclick=()=>go('#/code/'+p.id);
      const del=h('button',{class:'btn sm ghost icon',style:'position:absolute;right:10px;top:10px',html:ic('trash-2')}); del.onclick=async e=>{ e.stopPropagation(); if(await confirmBox('コードを削除',`「${p.name}」を削除します。`,'削除',true)){ await DB.del('codeprojects',p.id); c.remove(); } }; c.append(del); grid.append(c); });
    return; }
  const snap=await FB.m.getDoc(DB.doc('codeprojects',arg)).catch(()=>null); if(!snap||!snap.exists()){ pg.append(h('div',{class:'empty',html:`<div class="ei">${ic('file-x')}</div><b>見つかりません</b>`})); return; }
  const d=snap.data(); Object.assign(CODE,{id:arg,name:d.name,files:d.files||[],active:d.active||(d.files[0]||{}).name,logs:[]});
  const name=h('input',{class:'field',value:CODE.name,style:'width:200px;padding:6px 10px;font-weight:700'}); name.onchange=()=>{ CODE.name=name.value.trim()||'コード'; codeSave(); };
  const back=h('button',{class:'btn ghost icon',html:ic('arrow-left'),title:'一覧へ',onclick:()=>go('#/code')});
  const zipB=h('button',{class:'btn ghost',html:ic('folder-down')+'<span class="lbl">ZIP</span>',title:'まとめて保存',onclick:()=>downloadBlob(makeZip(CODE.files),(CODE.name||'code')+'.zip')});
  const ghB=h('button',{class:'btn ghost',html:ic('github')+'<span class="lbl">GitHubへ</span>',onclick:()=>pushGitHub()});
  const appB=h('button',{class:'btn ghost',html:ic('layout-grid')+'<span class="lbl">マイアプリへ</span>',onclick:async()=>{ const {doc}=buildPreview(); const html=doc.replace(/<script>\(function\(\)\{const K='cv[^<]*<\/script>/,''); const ex=(S.apps||[]).find(a=>a.code===arg); try{ await saveApp({name:CODE.name,html,code:arg,id:ex&&ex.id,icon:ex&&ex.icon,color:ex&&ex.color}); toast(ex?'マイアプリを更新しました':'マイアプリに入れました','layout-grid'); }catch(e){ toast(e.message,'x'); } }});
  const pubB=h('button',{class:'btn ghost icon',title:'GitHub Pagesで公開',html:ic('globe'),onclick:()=>publishPages({name:CODE.name,files:CODE.files.map(f=>({name:f.name,content:f.content})),codeId:arg})});
  const openB=h('button',{class:'btn ghost icon',title:'別のタブで開く',html:ic('external-link'),onclick:()=>{ const {doc}=buildPreview(); const u=URL.createObjectURL(new Blob([doc],{type:'text/html'})); window.open(u,'_blank'); }});
  topBar('',{icon:'code-xml',right:[back,name,appB,zipB,ghB,pubB,openB]}); $('#top h1').style.display='none';
  const page=h('div',{class:'codePage'}); pg.append(page); const left=h('div',{class:'codeChat'}), work=h('div',{class:'codeWork'}); page.append(left,work);
  // 左：AIチャット
  const chat=chatView(left,{chatId:d.chat||'',kind:'code',compact:true,extraSys:CODE_SYS,placeholder:'作りたいものや直したいところを頼む…',toolFilter:t=>t.group==='code'||['web_search','read_webpage','create_image','memory_save','memory_search','run_javascript','github_repos','github_read','github_list','github_write','github_publish','save_app','create_chart','create_qr','ask_user','plan_set','plan_update'].includes(t.decl.name),onChat:id=>DB.put('codeprojects',arg,{chat:id}),
    emptyEl:()=>h('div',{class:'welcome',style:'padding:30px 4px'},h('div',{class:'orb',html:ic('code-xml')}),h('h2',{style:'font-size:22px'},'何を作りましょう？'),h('p',null,'例：「ブロック崩しを作って」「ボタンをもっとおしゃれに」「スマホでも見やすくして」'))});
  // 右：エディタ
  const tabs=h('div',{class:'codeTabs',style:'overflow-x:auto'}); const ed=h('div',{class:'editor'}); const ln=h('div',{class:'ln'}), edw=h('div',{class:'edw'}), pre=h('pre'), ta=h('textarea',{spellcheck:false,autocapitalize:'off',autocomplete:'off'}); edw.append(pre,ta); ed.append(ln,edw);
  const pv=h('div',{class:'preview'}); const pvh=h('div',{class:'pvh',html:ic('monitor')+'<b style="flex:1">プレビュー</b>'}); const auto=toggle(LS.get('codeAuto',true),v=>LS.set('codeAuto',v)); const runB=h('button',{class:'btn sm pri',html:ic('play')+'実行'}); pvh.append(h('small',{class:'muted'},'自動'),auto,runB); const frame=h('iframe',{sandbox:'allow-scripts allow-modals allow-forms allow-pointer-lock allow-popups allow-downloads',title:'プレビュー'}); const cons=h('div',{class:'console'}); pv.append(pvh,frame,cons); work.append(tabs,ed,pv);
  const paintTabs=()=>{ tabs.innerHTML=''; CODE.files.forEach(f=>{ const b=h('button',{class:'fileTab'+(f.name===CODE.active?' on':''),html:ic(fileIcon(f.name))+esc(f.name)}); b.onclick=()=>{ CODE.active=f.name; paintTabs(); paintEd(); codeSave(); }; const x=h('span',{class:'fx',html:ic('x'),title:'消す'}); x.onclick=async e=>{ e.stopPropagation(); if(await confirmBox('ファイルを消す',f.name+' を消します。','消す',true)) TOOLS.code_delete.run({name:f.name}); }; b.append(x); tabs.append(b); });
    const nb=h('button',{class:'btn sm ghost icon',html:ic('plus'),title:'新しいファイル'}); nb.onclick=()=>{ modal((m,close)=>{ const i=h('input',{class:'field',placeholder:'例：game.js'}); m.append(h('h3',null,'新しいファイル'),i,h('div',{class:'modalFoot'},h('button',{class:'btn ghost',onclick:close},'やめる'),h('button',{class:'btn pri',onclick:()=>{ const n=i.value.trim(); if(!n) return; codeSet(n,''); CODE.active=n; paintTabs(); paintEd(); close(); }},'作る'))); setTimeout(()=>i.focus(),50); }); };
    const up=h('button',{class:'btn sm ghost icon',html:ic('upload'),title:'ファイルを読み込む'}); const fi=h('input',{type:'file',multiple:true,style:'display:none'}); up.onclick=()=>fi.click(); fi.onchange=async()=>{ for(const f of fi.files) codeSet(f.name,await f.text()); fi.value=''; paintTabs(); }; tabs.append(nb,up,fi); };
  const paintEd=()=>{ const f=CODE.files.find(x=>x.name===CODE.active); ta.value=f?f.content:''; ta.disabled=!f; paintHl(); };
  const paintHl=()=>{ const v=ta.value; pre.innerHTML=hl(v,langOf(CODE.active||''))+'\n'; ln.textContent=v.split('\n').map((_,i)=>i+1).join('\n'); const lines=v.split('\n'); ta.style.width=pre.style.width=Math.max(edw.clientWidth,Math.max(...lines.map(l=>l.length))*7.9+40)+'px'; ta.style.height=pre.style.height=Math.max(edw.clientHeight,lines.length*21.5+30)+'px'; };
  edw.onscroll=()=>{ ln.scrollTop=edw.scrollTop; };
  let runT=0; ta.oninput=()=>{ paintHl(); const f=CODE.files.find(x=>x.name===CODE.active); if(f){ f.content=ta.value; codeSave(); } if(auto.classList.contains('on')){ clearTimeout(runT); runT=setTimeout(run,900); } };
  ta.onkeydown=e=>{ if(e.key==='Tab'){ e.preventDefault(); const s=ta.selectionStart; ta.setRangeText('  ',s,ta.selectionEnd,'end'); ta.oninput(); } if((e.metaKey||e.ctrlKey)&&e.key==='s'){ e.preventDefault(); run(); toast('保存して実行しました','check'); } };
  let key=''; const onMsg=e=>{ if(!e.data||e.data.k!==key) return; CODE.logs.push({t:e.data.t,v:e.data.v}); const row=h('div',{class:e.data.t==='error'?'err':''},(e.data.t==='error'?'× ':e.data.t==='warn'?'! ':'› ')+e.data.v); cons.append(row); cons.scrollTop=cons.scrollHeight; }; addEventListener('message',onMsg);
  function run(){ const b=buildPreview(); key=b.key; CODE.logs=[]; cons.innerHTML=''; frame.srcdoc=b.doc; } CODE.run=run; runB.onclick=run;
  CODE.onChange=n=>{ if(n&&!CODE.files.find(x=>x.name===CODE.active)) CODE.active=n; if(n) CODE.active=n; paintTabs(); paintEd(); if(auto.classList.contains('on')){ clearTimeout(runT); runT=setTimeout(run,400); } };
  paintTabs(); paintEd(); run(); const ro=new ResizeObserver(paintHl); ro.observe(edw);
  CUR.cleanup=()=>{ removeEventListener('message',onMsg); ro.disconnect(); chat.destroy(); CODE.onChange=null; CODE.run=null; }; };
/* ---------- ZIP（無圧縮） ---------- */
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
function makeZip(files){ const enc=new TextEncoder(); const parts=[], central=[]; let off=0;
  for(const f of files){ const name=enc.encode(f.name), data=enc.encode(f.content); let crc=0xFFFFFFFF; for(const b of data) crc=CRC[(crc^b)&255]^(crc>>>8); crc=(crc^0xFFFFFFFF)>>>0;
    const lh=new DataView(new ArrayBuffer(30)); lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint32(14,crc,true); lh.setUint32(18,data.length,true); lh.setUint32(22,data.length,true); lh.setUint16(26,name.length,true); parts.push(lh.buffer,name,data);
    const ch=new DataView(new ArrayBuffer(46)); ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint32(16,crc,true); ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true); ch.setUint16(28,name.length,true); ch.setUint32(42,off,true); central.push(ch.buffer,name); off+=30+name.length+data.length; }
  const csize=central.reduce((a,b)=>a+(b.byteLength||b.length),0); const end=new DataView(new ArrayBuffer(22)); end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true); end.setUint32(12,csize,true); end.setUint32(16,off,true);
  return new Blob([...parts,...central,end.buffer],{type:'application/zip'}); }
function pushGitHub(){ if(!SEC.get('github')){ toast('先に カスタマイズ → アプリ接続 で GitHub をつないでください','info',3500); return; }
  modal(async(m,close)=>{ m.append(h('h3',null,'GitHubに送る'),h('p',{class:'muted',style:'font-size:13px;margin:0 0 6px'},'すべてのファイルを、選んだリポジトリにコミットします。'));
    const sel=h('select',{class:'field'},h('option',null,'読み込み中…')); const dir=h('input',{class:'field',placeholder:'フォルダ（空ならいちばん上）'}); const msg=h('input',{class:'field',value:'エージェントAiから更新'}); m.append(h('label',{class:'lab'},'リポジトリ'),sel,h('label',{class:'lab'},'フォルダ'),dir,h('label',{class:'lab'},'メッセージ'),msg);
    const go2=h('button',{class:'btn pri',html:ic('upload')+'送る'}); m.append(h('div',{class:'modalFoot'},h('button',{class:'btn ghost',onclick:close},'やめる'),go2));
    try{ const r=await ghfetch('/user/repos?sort=updated&per_page=60'); sel.innerHTML=''; r.forEach(x=>sel.append(h('option',{value:x.full_name},x.full_name))); }catch(e){ sel.innerHTML=''; sel.append(h('option',null,e.message)); }
    go2.onclick=async()=>{ go2.disabled=true; const repo=sel.value, base=dir.value.trim().replace(/^\/|\/$/g,''); try{ for(const f of CODE.files){ go2.innerHTML=ic('loader')+esc(f.name); const path=(base?base+'/':'')+f.name; let sha; try{ sha=(await ghfetch(`/repos/${repo}/contents/${path}`)).sha; }catch(e){} await ghfetch(`/repos/${repo}/contents/${path}`,{method:'PUT',body:JSON.stringify({message:msg.value||'update',content:b64u(f.content),sha})}); } close(); toast('GitHubに送りました','check'); }catch(e){ toast('失敗：'+e.message,'x',4000); go2.disabled=false; go2.innerHTML=ic('upload')+'送る'; } }; },{wide:false}); }
