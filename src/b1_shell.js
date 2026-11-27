/* ===== 画面のわく：サイドバー・ページ切り替え・ログイン ===== */
const LOGO=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f6bff"/><stop offset=".55" stop-color="#7a5cff"/><stop offset="1" stop-color="#2bd9a0"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M19 47 31 17h2l12 30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.5 37h15" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M48 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/></svg>`;
const LOGO_URL='data:image/svg+xml;utf8,'+encodeURIComponent(LOGO);
const NAV=[['chat','新しいチャット','square-pen'],['home','ホーム','house'],['projects','プロジェクト','folder-kanban'],['code','コード','code-xml'],['library','ライブラリ','images'],['schedule','スケジュール','calendar-clock'],['feed','フィード','newspaper'],['custom','カスタマイズ','sliders-horizontal']];
const PAGES={}; let CUR={page:'',arg:'',cleanup:null};
const PCOLORS=['#4f6bff','#7a5cff','#2bd9a0','#f59e0b','#ef4444','#ec4899','#0ea5e9','#14b8a6','#64748b'];

function renderShell(){ const app=$('#app'); app.innerHTML='';
  const side=h('aside',{class:'side'}); const brand=h('div',{class:'brand',html:`<img src="${LOGO_URL}" alt=""><span>エージェントAi</span>`}); const col=h('button',{class:'collapse',title:'サイドバーを細くする',html:ic('panel-left')}); col.onclick=()=>DB.setSettings({sideMini:!S.settings.sideMini}); brand.append(col); side.append(brand);
  NAV.forEach(([id,t,i])=>{ const b=h('button',{class:'nav'+(id==='chat'?' new':''),'data-nav':id,html:ic(i)+`<span class="lbl">${t}</span>`+(id==='chat'?'<span class="kbd lbl">⌘K</span>':'')}); b.onclick=()=>{ closeDrawer(); go(id==='chat'?'#/new':'#/'+id); }; side.append(b); });
  const TOOLNAV=[['todo','ToDo','list-todo'],['calendar','カレンダー','calendar-days'],['money','家計簿','wallet'],['apps','マイアプリ','layout-grid'],['log','作業ログ','scroll-text']]; const tg=h('button',{class:'nav navTools'+(LS.get('toolsOpen',false)?' open':''),html:ic('blocks')+'<span class="lbl">ツール</span>'+ic('chevron-right','chev lbl')}); const tl=h('div',{class:'toolNav'}); if(!LS.get('toolsOpen',false)) tl.style.display='none';
  tg.onclick=()=>{ const o=!LS.get('toolsOpen',false); LS.set('toolsOpen',o); tg.classList.toggle('open',o); tl.style.display=o?'':'none'; }; TOOLNAV.forEach(([id,t,i])=>{ const b=h('button',{class:'nav sub','data-nav':id,html:ic(i)+`<span class="lbl">${t}</span>`}); b.onclick=()=>{ closeDrawer(); go('#/'+id); }; tl.append(b); }); side.append(tg,tl);
  side.append(h('div',{class:'sideLab',id:'recentLab'},'最近のチャット')); const rec=h('div',{class:'recent',id:'recent'}); side.append(rec);
  const me=h('div',{class:'me',id:'me'}); side.append(me);
  const main=h('main',{class:'main'}); const top=h('header',{class:'top',id:'top'}); main.append(top,h('div',{class:'view',id:'view'}));
  const scrim=h('div',{class:'mScrim'}); scrim.onclick=closeDrawer; app.append(side,scrim,main);
  paintRecent(); paintMe(); }
function closeDrawer(){ document.body.classList.remove('sideOpen'); }
function topBar(title,{icon,right=[],sub}={}){ const t=$('#top'); t.innerHTML=''; const mb=h('button',{class:'menuBtn btn icon ghost',html:ic('menu'),title:'メニュー'}); mb.onclick=()=>document.body.classList.add('sideOpen'); t.append(mb); const h1=h('h1',{html:(icon?ic(icon):'')+`<span>${esc(title)}</span>`}); if(sub) h1.append(sub); t.append(h1,h('div',{class:'sp'}),...right); }
function paintMe(){ const me=$('#me'); if(!me||!S.user) return; const u=S.user; me.innerHTML=''; const av=u.photoURL?h('img',{class:'av',src:u.photoURL,referrerpolicy:'no-referrer'}):h('div',{class:'av'},(u.displayName||u.email||'?')[0].toUpperCase()); const p=curProject();
  me.append(av,h('div',{style:'min-width:0;flex:1',html:`<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.displayName||u.email||'ユーザー')}</b><small><i class="sync ${S.online&&S.synced?'':'off'}"></i>${S.online?(S.synced?'同期済み':'同期中…'):'オフライン'}${p?' ／ '+esc(p.name):''}</small>`})); me.onclick=()=>go('#/custom/general'); me.style.cursor='pointer'; }
var paintRecent=function(){ const r=$('#recent'); if(!r) return; const p=S.curProject; const list=S.chats.filter(c=>c.kind!=='code'&&(!p||c.project===p)).slice(0,60); r.innerHTML='';
  $('#recentLab').textContent=p&&curProject()?'最近のチャット・'+curProject().name:'最近のチャット';
  if(!list.length){ r.append(h('div',{style:'padding:8px 12px;font-size:12.5px;color:var(--sideInk2)'},'まだチャットはありません')); return; }
  let lastGroup=''; list.forEach(c=>{ const d=Date.now()-(c.updated||0); const g=d<86400e3?'今日':d<86400e3*7?'この7日間':'それより前'; if(g!==lastGroup){ lastGroup=g; r.append(h('div',{style:'font-size:11px;color:var(--sideInk2);padding:10px 12px 4px;opacity:.75'},g)); }
    const pr=S.projects[c.project]; const b=h('button',{class:'rc'+(CUR.page==='chat'&&CUR.arg===c.id?' on':''),html:`<b>${esc(c.title||'新しいチャット')}</b><small>${c.kind==='schedule'?ic('calendar-clock')+' ':''}${pr?`<i class="dot" style="background:${pr.color}"></i>`:''}${ago(c.updated)}</small>`});
    b.onclick=()=>{ closeDrawer(); go('#/chat/'+c.id); }; const x=h('span',{class:'rcx',html:ic('trash-2'),title:'削除'}); x.onclick=async e=>{ e.stopPropagation(); if(await confirmBox('チャットを削除','「'+(c.title||'')+'」を削除します。元に戻せません。','削除',true)){ await delChat(c.id); if(CUR.arg===c.id) go('#/new'); toast('削除しました','trash-2'); } }; b.append(x); r.append(b); }); };
function paintNav(){ document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===CUR.page&&!(CUR.page==='chat'))); }
function go(hash){ if(location.hash===hash) route(); else location.hash=hash; }
function route(){ const [,page='new',arg='']=(location.hash||(S.settings.startPage==='home'?'#/home':'#/new')).split('/'); const p=page==='new'?'chat':page; if(CUR.cleanup){ try{ CUR.cleanup(); }catch(e){} CUR.cleanup=null; }
  CUR={page:p,arg:page==='new'?'':decodeURIComponent(arg),cleanup:null}; const v=$('#view'); v.innerHTML=''; const pg=h('div',{class:'page'}); v.append(pg); (PAGES[p]||PAGES.chat)(pg,CUR.arg); paintNav(); paintRecent(); }
addEventListener('hashchange',()=>S.user&&route());
addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); go('#/new'); } });

/* ---------- ログイン ---------- */
function renderLogin(err){ const app=$('#app'); app.innerHTML=''; const L=h('div',{class:'login'}); L.append(h('div',{class:'orbs',html:'<i style="width:420px;height:420px;background:#4f6bff;left:-120px;top:-80px"></i><i style="width:360px;height:360px;background:#2bd9a0;right:-100px;bottom:-60px;animation-delay:-6s"></i><i style="width:260px;height:260px;background:#7a5cff;right:20%;top:10%;animation-delay:-11s"></i>'}));
  const c=h('div',{class:'lc'}); c.append(h('img',{src:LOGO_URL,alt:''}),h('h1',null,'エージェントAi'),h('p',null,'調べる・作る・送るまで、ぜんぶ手伝うAIエージェント。データはアカウントに保存して、どの端末でも続きから。'));
  const g=h('button',{class:'btn',html:`<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>Googleでログイン`});
  g.onclick=async()=>{ g.disabled=true; try{ await signInGoogle(); }catch(e){ toast('Googleでログインできませんでした（'+(e.code||e.message)+'）。下の「メールアドレスでログイン」も使えます','x',6000); } g.disabled=false; };
  const em=h('button',{class:'btn alt',html:ic('mail')+'メールアドレスでログイン'}); em.onclick=()=>emailLogin();
  c.append(g,em,h('div',{class:'feat',html:`<span>${ic('cloud')}端末をまたいで同期</span><span>${ic('shield-check')}キーは端末の中だけ</span><span>${ic('wifi-off')}アプリを開いている間だけ動く</span>`}));
  if(err) c.append(h('p',{style:'color:#fca5a5;margin-top:14px'},err)); L.append(c); app.append(L); }
function emailLogin(){ modal((m,close)=>{ let create=false; m.append(h('h3',null,'メールアドレスでログイン'),h('p',{class:'muted',style:'margin:0 0 14px;font-size:13px'},'ほかの tai アカウントのアプリと同じアカウントが使えます。'));
  const e=h('input',{class:'field',type:'email',placeholder:'メールアドレス',autocomplete:'email'}), p=h('input',{class:'field',type:'password',placeholder:'パスワード（6文字以上）',autocomplete:'current-password',style:'margin-top:10px'}); const sg=segmented([['in','ログイン'],['up','新しく作る']],'in',v=>create=v==='up'); m.append(sg,h('div',{style:'height:12px'}),e,p);
  const f=h('div',{class:'modalFoot'}); const ok=h('button',{class:'btn pri'},'続ける'); ok.onclick=async()=>{ ok.disabled=true; try{ await signInEmail(e.value.trim(),p.value,create); close(); }catch(er){ toast({'auth/invalid-credential':'メールかパスワードがちがいます','auth/email-already-in-use':'そのメールはもう使われています','auth/weak-password':'パスワードは6文字以上にしてください'}[er.code]||er.message,'x',3500); } ok.disabled=false; };
  f.append(h('button',{class:'btn ghost',onclick:close},'やめる'),ok); m.append(f); setTimeout(()=>e.focus(),50); }); }
