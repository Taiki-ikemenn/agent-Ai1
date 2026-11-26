/* ===== ライブラリ（作った画像・音楽・動画・ファイル） ===== */
const KINDS={image:['画像','image'],music:['音楽','music'],video:['動画','clapperboard'],file:['ファイル','file-text']};
PAGES.library=pg=>{ let kind=LS.get('libKind','all'), q='';
  const search=h('input',{class:'field',placeholder:'さがす',style:'width:200px;padding:8px 12px'}); search.oninput=()=>{ q=search.value.toLowerCase(); paint(); };
  topBar('ライブラリ',{icon:'images',right:[search]});
  const w=h('div',{class:'wrap',style:'max-width:1280px'}); pg.append(w); w.append(h('div',{class:'pageHead',html:'<h2>ライブラリ</h2><p>AIが作った画像・音楽・動画・ファイルがここにたまります。どの端末からでも見られます。</p>'}));
  const seg=segmented([['all','すべて','layout-grid'],['image','画像','image'],['music','音楽','music'],['video','動画','clapperboard'],['file','ファイル','file-text']],kind,v=>{ kind=v; LS.set('libKind',v); paint(); }); w.append(h('div',{style:'margin-bottom:18px;overflow:auto'},seg));
  const grid=h('div',{class:'libGrid'}); w.append(grid);
  const paint=()=>{ grid.innerHTML=''; const items=S.library.filter(x=>(kind==='all'||x.kind===kind)&&(!q||((x.name||'')+(x.prompt||'')).toLowerCase().includes(q)));
    if(!items.length){ grid.style.columns='auto'; grid.append(h('div',{class:'empty',html:`<div class="ei">${ic('images')}</div><b>まだありません</b>チャットで「〇〇の画像を作って」「BGMを作って」と頼んでみてね。`})); return; } grid.style.columns='';
    items.forEach((x,i)=>{ const [kn,ki]=KINDS[x.kind]||['?','file']; const c=h('div',{class:'libItem',style:`animation-delay:${Math.min(i,20)*.03}s`});
      if(x.kind==='image'&&x.thumb) c.append(h('img',{src:x.thumb,alt:'',loading:'lazy'})); else { const ph=h('div',{class:'ph',html:ic(ki)}); if(x.kind==='music') ph.style.background='linear-gradient(135deg,#14b8a6,#4f6bff)'; if(x.kind==='video') ph.style.background='linear-gradient(135deg,#1d2a63,#0f4d44)'; if(x.kind!=='file') ph.style.color='#fff'; if(x.kind==='video'&&x.recipe&&x.recipe.scenes&&x.recipe.scenes[0]){ ph.style.background=`#0f1524 url("${sceneURL(x.recipe.scenes[0],false).replace('width=1280&height=720','width=480&height=270')}") center/cover`; } c.append(ph); }
      c.append(h('span',{class:'kind',html:ic(ki)+kn}),h('div',{class:'lt',html:`<b>${esc(x.name)}</b><small class="muted">${ago(x.at)}</small>`})); c.onclick=()=>openLibItem(x.id); grid.append(c); }); };
  paint(); const off=BUS.on('library',paint); CUR.cleanup=off; };
async function openLibItem(id){ const x=S.library.find(i=>i.id===id); if(!x) return toast('見つかりません','x'); modal(async(m,close)=>{ const v=h('div',{class:'viewer'}); const vm=h('div',{class:'vm'}), vi=h('div',{class:'vi'}); v.append(vm,vi); m.append(v);
  const [kn,ki]=KINDS[x.kind]||['?','file']; vi.append(h('span',{class:'chip on',html:ic(ki)+kn}),h('h3',{style:'margin:10px 0 6px;word-break:break-all'},x.name),h('div',{class:'muted',style:'font-size:13px;margin-bottom:12px'},fmtDT(x.at)+(x.via?' ・ '+x.via+'で作成':'')));
  if(x.prompt) vi.append(h('label',{class:'lab'},'指示'),h('div',{style:'font-size:13px;line-height:1.7;background:var(--panel2);border-radius:12px;padding:10px 12px;max-height:160px;overflow:auto;white-space:pre-wrap'},x.prompt));
  const acts=h('div',{class:'row',style:'flex-wrap:wrap;margin-top:16px'}); vi.append(acts);
  if(x.kind==='image'){ const img=h('img',{src:x.thumb}); vm.append(img); const d=await libData(id); if(d&&d.data) img.src=d.data; acts.append(h('button',{class:'btn pri',html:ic('download')+'保存',onclick:()=>d&&downloadBlob(b64ToBlob(d.data.split(',')[1],'image/jpeg'),x.name)}),h('button',{class:'btn',html:ic('wand-sparkles')+'似た画像を作る',onclick:()=>{ close(); go('#/new'); setTimeout(()=>{ const t=document.querySelector('.cbox textarea'); if(t){ t.value='この画像に似た雰囲気で、少し変えた画像を作って：'+x.prompt; t.dispatchEvent(new Event('input')); } },300); }})); }
  else if(x.kind==='music'||x.kind==='video') vm.append(mediaEl({kind:x.kind,lib:id,name:x.name,recipe:x.recipe}));
  else { const d=await libData(id); const c=d&&d.content||''; vm.append(codeBlock(c.slice(0,30000),langOf(x.name),x.name)); if(canPreview(x.name)) acts.append(h('button',{class:'btn pri',html:ic('eye')+'プレビュー',onclick:()=>previewModal(x.name,c)}));
    acts.append(h('button',{class:'btn'+(canPreview(x.name)?'':' pri'),html:ic('download')+'保存',onclick:()=>downloadText(c,x.name)}),h('button',{class:'btn',html:ic('code-xml')+'コード画面で開く',onclick:()=>{ close(); openCodeWith([{name:x.name,content:c}]); }})); }
  if(x.chat) acts.append(h('button',{class:'btn ghost',html:ic('message-square')+'作ったチャット',onclick:()=>{ close(); go('#/chat/'+x.chat); }}));
  acts.append(h('button',{class:'btn ghost danger',html:ic('trash-2')+'削除',onclick:async()=>{ if(await confirmBox('削除',x.name+' を削除します。','削除',true)){ await libDelete(id); close(); } }}));
  m.append(h('div',{class:'modalFoot'},h('button',{class:'btn ghost',onclick:close},'閉じる'))); },{wide:true}); }
