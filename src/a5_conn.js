/* ===== アプリ接続 ===== */
// 秘密の情報（トークン）はこの端末だけに保存。アカウントには同期しない
const SEC={ get(k){ return LS.get('sec_'+k,null); }, set(k,v){ LS.set('sec_'+k,v); BUS.emit('conn'); }, del(k){ LS.del('sec_'+k); BUS.emit('conn'); } };
const GSCOPES={gmail:'https://www.googleapis.com/auth/gmail.modify',contacts:'https://www.googleapis.com/auth/contacts',forms:'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/drive.file',youtube:'https://www.googleapis.com/auth/youtube.readonly'};
function loadScript(src){ return new Promise((ok,ng)=>{ if(document.querySelector(`script[src="${src}"]`)) return ok(); const s=h('script',{src,async:true}); s.onload=ok; s.onerror=()=>ng(new Error('読み込めませんでした：'+src)); document.head.append(s); }); }
function gTok(){ const t=SEC.get('google'); return t&&t.exp>Date.now()+60e3?t:null; }
function gHas(svc){ const t=SEC.get('google'); return !!(t&&t.scopes&&GSCOPES[svc].split(' ').every(s=>t.scopes.includes(s))); }
async function googleConnect(svcs){ const cid=(S.settings.conn.google||{}).clientId; if(!cid) throw new Error('GoogleのクライアントIDが未設定です（セットアップ手順.txt を見てね）');
  await loadScript('https://accounts.google.com/gsi/client'); const prev=SEC.get('google'); const want=new Set([...(prev&&prev.scopes?prev.scopes.split(' '):[]),...svcs.flatMap(s=>GSCOPES[s].split(' '))]);
  return new Promise((ok,ng)=>{ const c=google.accounts.oauth2.initTokenClient({client_id:cid,scope:[...want].join(' '),include_granted_scopes:true,callback:r=>{ if(r.error) return ng(new Error(r.error_description||r.error)); SEC.set('google',{token:r.access_token,exp:Date.now()+(r.expires_in||3600)*1000,scopes:r.scope}); ok(); },error_callback:e=>ng(new Error(e.message||e.type||'キャンセルされました'))}); c.requestAccessToken({prompt:prev?'':'consent'}); }); }
async function gfetch(url,opt={}){ const t=gTok(); if(!t) throw new Error('Googleとの接続が切れています。カスタマイズ → アプリ接続 で「再接続」を押してください（1時間ごとに必要）'); const r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+t.token,'Content-Type':'application/json',...(opt.headers||{})}}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error((j.error&&(j.error.message||j.error))||('HTTP '+r.status)); return j; }

/* ---------- Spotify（PKCE） ---------- */
const SP_SCOPES='user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-modify-private playlist-modify-public user-top-read';
const redirectURI=()=>location.origin+location.pathname;
async function spotifyConnect(){ const cid=(S.settings.conn.spotify||{}).clientId; if(!cid) throw new Error('SpotifyのクライアントIDが未設定です');
  const v=Array.from(crypto.getRandomValues(new Uint8Array(48)),b=>('0'+b.toString(16)).slice(-2)).join(''); const dig=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)); const ch=btoa(String.fromCharCode(...new Uint8Array(dig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  LS.set('sp_verifier',v); location.href='https://accounts.spotify.com/authorize?'+new URLSearchParams({client_id:cid,response_type:'code',redirect_uri:redirectURI(),code_challenge_method:'S256',code_challenge:ch,scope:SP_SCOPES,state:'agentai_sp'}); }
async function spotifyCallback(){ const q=new URLSearchParams(location.search); if(q.get('state')!=='agentai_sp') return; history.replaceState(null,'',location.pathname+location.hash); const code=q.get('code'); if(!code){ toast('Spotifyの接続をやめました','x'); return; }
  const cid=(S.settings.conn.spotify||{}).clientId||LS.get('sp_cid',''); const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectURI(),client_id:cid,code_verifier:LS.get('sp_verifier','')})});
  const j=await r.json(); if(j.access_token){ SEC.set('spotify',{token:j.access_token,refresh:j.refresh_token,exp:Date.now()+j.expires_in*1000}); toast('Spotifyにつながりました','check'); } else toast('Spotify：'+(j.error_description||j.error),'x'); }
async function spfetch(path,opt={}){ let t=SEC.get('spotify'); if(!t) throw new Error('Spotifyが未接続です'); if(t.exp<Date.now()+60e3&&t.refresh){ const cid=(S.settings.conn.spotify||{}).clientId; const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:t.refresh,client_id:cid})}); const j=await r.json(); if(j.access_token){ t={token:j.access_token,refresh:j.refresh_token||t.refresh,exp:Date.now()+j.expires_in*1000}; SEC.set('spotify',t); } }
  const r=await fetch('https://api.spotify.com/v1'+path,{...opt,headers:{Authorization:'Bearer '+t.token,'Content-Type':'application/json'}}); if(r.status===204) return {ok:true}; const j=await r.json().catch(()=>({ok:r.ok})); if(!r.ok) throw new Error((j.error&&j.error.message)||('HTTP '+r.status)+(r.status===404?'（Spotifyアプリでどれかの端末を再生中にしてください）':'')); return j; }

/* ---------- GitHub（個人のトークン） ---------- */
async function ghfetch(path,opt={}){ const t=SEC.get('github'); if(!t) throw new Error('GitHubが未接続です（トークンを入れてください）'); const r=await fetch('https://api.github.com'+path,{...opt,headers:{Authorization:'Bearer '+t.token,Accept:'application/vnd.github+json',...(opt.body?{'Content-Type':'application/json'}:{})}}); const j=r.status===204?{}:await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.message||('HTTP '+r.status)); return j; }
const b64u=s=>btoa(unescape(encodeURIComponent(s))); const ub64=s=>decodeURIComponent(escape(atob(s.replace(/\s/g,''))));

/* ---------- 接続の一覧 ---------- */
const CONNS=[
  {id:'gmail',name:'Gmail',icon:'mail',color:'#ea4335',desc:'メールを探す・読む・下書き・送信',kind:'google'},
  {id:'github',name:'GitHub',icon:'github',color:'#24292f',desc:'リポジトリを見る・ファイルを書く・Issue',kind:'token'},
  {id:'weather',name:'天気',icon:'cloud-sun',color:'#2aa4f4',desc:'Open-Meteoで今の天気と予報（設定不要）',kind:'free'},
  {id:'youtube',name:'YouTube',icon:'youtube',color:'#ff0033',desc:'動画を探して、チャットの中で再生',kind:'google-opt'},
  {id:'browser',name:'ブラウザ',icon:'globe',color:'#4f6bff',desc:'Web検索・ページを読む・リンクを開く（設定不要）',kind:'free'},
  {id:'canva',name:'Canva',icon:'palette',color:'#00c4cc',desc:'デザインの指示書を作ってCanvaを開く',kind:'link'},
  {id:'spotify',name:'Spotify',icon:'disc-3',color:'#1db954',desc:'曲を探す・再生・プレイリスト作成',kind:'spotify'},
  {id:'contacts',name:'Google連絡先',icon:'contact',color:'#1a73e8',desc:'連絡先を探す・追加',kind:'google'},
  {id:'forms',name:'Googleフォーム',icon:'clipboard-list',color:'#7248b9',desc:'アンケートを作る・回答を集計',kind:'google'},
  {id:'adobe',name:'Adobe Express',icon:'pen-tool',color:'#eb1000',desc:'デザインの指示書を作ってAdobe Expressを開く',kind:'link'}];
function connOk(c){ if(c.kind==='free'||c.kind==='link') return S.settings.conn[c.id]?S.settings.conn[c.id].on!==false:true; if(c.kind==='google') return gHas(c.id); if(c.kind==='google-opt') return true; if(c.kind==='token') return !!SEC.get('github'); if(c.kind==='spotify') return !!SEC.get('spotify'); return false; }
function connState(c){ const ok=connOk(c); if(c.kind==='google'&&ok&&!gTok()) return 'half'; return ok?'on':'off'; }
function connStatusList(){ return CONNS.map(c=>({...c,ok:connOk(c),state:connState(c)})); }
