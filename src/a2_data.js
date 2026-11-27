/* ===== アカウントと同期（Firebase：tai-account） ===== */
const FB_CONFIG={apiKey:"AIzaSyDNKPM8KCe6RGWuaQOUDorBtjCD3IGoe1E",authDomain:"tai-account.firebaseapp.com",databaseURL:"https://tai-account-default-rtdb.firebaseio.com",projectId:"tai-account",storageBucket:"tai-account.firebasestorage.app",messagingSenderId:"579819210756",appId:"1:579819210756:web:7eba19a9d4c2ac7697cd51"};
const FBV='10.12.2';
const FB={m:null,app:null,auth:null,db:null,user:null,ready:null};
const DEF_SETTINGS={theme:'auto',model:'lite',memoryOn:true,crossChat:true,notify:true,webAuto:true,
  instr:{about:'',style:'',lang:'ja',length:50,formality:60,detail:60},
  conn:{google:{clientId:''},spotify:{clientId:''},github:{user:''},weather:{place:'越谷市'},youtube:{on:true},browser:{on:true},canva:{on:true},adobe:{on:true}},
  feed:{prompt:'テクノロジー、AI、ゲーム、日本のニュースを中心に。むずかしい話はやさしく。',topics:[['テクノロジー',80],['AI',90],['ゲーム',60],['科学',50],['スポーツ',20],['エンタメ',40]],count:6,every:180,tone:50},
  sideMini:false};
const S={ user:null, settings:JSON.parse(JSON.stringify(DEF_SETTINGS)), projects:{}, curProject:LS.get('curProject',''), chats:[], memories:[], library:[], schedules:[], feed:[], online:navigator.onLine, synced:false, subs:[] };
const BUS={ ev:{}, on(n,f){ (this.ev[n]=this.ev[n]||[]).push(f); return ()=>{ this.ev[n]=this.ev[n].filter(x=>x!==f); }; }, emit(n,...a){ (this.ev[n]||[]).forEach(f=>{ try{ f(...a); }catch(e){ console.error(e); } }); } };
addEventListener('online',()=>{ S.online=true; BUS.emit('sync'); }); addEventListener('offline',()=>{ S.online=false; BUS.emit('sync'); });

async function fbInit(){ if(FB.ready) return FB.ready; FB.ready=(async()=>{ const base=`https://www.gstatic.com/firebasejs/${FBV}/`;
  const [a,au,fs]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  FB.m={...a,...au,...fs}; FB.app=a.getApps().find(x=>x.name==='agentai')||a.initializeApp(FB_CONFIG,'agentai'); FB.auth=au.getAuth(FB.app);
  try{ FB.db=fs.initializeFirestore(FB.app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()})}); }catch(e){ FB.db=fs.getFirestore(FB.app); }
  try{ await au.setPersistence(FB.auth,au.browserLocalPersistence); }catch(e){}
  try{ await au.getRedirectResult(FB.auth); }catch(e){}
  await new Promise(res=>{ let first=true; au.onAuthStateChanged(FB.auth,u=>{ FB.user=u; S.user=u; if(first){ first=false; res(); } BUS.emit('auth',u); }); });
})(); return FB.ready; }
async function signInGoogle(){ const m=FB.m; const p=new m.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'});
  // ホーム画面アプリ（iOS）ではリダイレクト方式が戻ってこられないので、ポップアップを使う
  try{ await m.signInWithPopup(FB.auth,p); }catch(e){ if(/popup-blocked|operation-not-supported/.test(e.code||'')) await m.signInWithRedirect(FB.auth,p); else if(!/popup-closed|cancelled-popup/.test(e.code||'')) throw e; } }
async function signInEmail(email,pass,create){ const m=FB.m; if(create) return m.createUserWithEmailAndPassword(FB.auth,email,pass); return m.signInWithEmailAndPassword(FB.auth,email,pass); }
async function signOutAll(){ stopSync(); await FB.m.signOut(FB.auth); location.reload(); }

/* ---------- データの場所：agentai/{uid}/... ---------- */
const settingsOut=st=>{ const o=JSON.parse(JSON.stringify(st)); if(o.feed&&Array.isArray(o.feed.topics)) o.feed.topics=o.feed.topics.map(t=>Array.isArray(t)?{n:t[0],w:t[1]}:t); return o; };
const settingsIn=st=>{ if(st&&st.feed&&Array.isArray(st.feed.topics)) st.feed.topics=st.feed.topics.map(t=>Array.isArray(t)?t:[t.n,t.w]); return st; };
const DB={ base(){ return ['agentai',FB.user.uid]; }, col(...p){ return FB.m.collection(FB.db,...this.base(),...p); }, doc(...p){ return FB.m.doc(FB.db,...this.base(),...p); },
  clean(o){ return JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v)); },
  async put(col,id,data,merge=true){ return FB.m.setDoc(this.doc(col,id),this.clean(data),{merge}); },
  async del(col,id){ return FB.m.deleteDoc(this.doc(col,id)); },
  async setSettings(patch){ S.settings=deepMerge(S.settings,patch); applyTheme(); BUS.emit('settings'); try{ await FB.m.setDoc(FB.m.doc(FB.db,...this.base()),{settings:this.clean(settingsOut(S.settings)),updated:Date.now()},{merge:true}); }catch(e){ console.warn(e); } } };
function deepMerge(a,b){ const o=Array.isArray(a)?a.slice():{...a}; for(const k in b){ const v=b[k]; if(v&&typeof v==='object'&&!Array.isArray(v)&&a&&typeof a[k]==='object'&&!Array.isArray(a[k])) o[k]=deepMerge(a[k],v); else o[k]=v; } return o; }
function stopSync(){ S.subs.forEach(f=>{ try{ f(); }catch(e){} }); S.subs=[]; }
function startSync(){ stopSync(); const m=FB.m; const sub=(q,f)=>S.subs.push(m.onSnapshot(q,{includeMetadataChanges:false},f,e=>console.warn('sync',e)));
  sub(m.doc(FB.db,...DB.base()),s=>{ const d=s.data()||{}; if(d.settings){ S.settings=deepMerge(DEF_SETTINGS,settingsIn(d.settings)); S.settings.model=roleOf(S.settings.model); if(!LS.get('modelMig1',0)){ LS.set('modelMig1',1); if(S.settings.model==='fast'){ S.settings.model='lite'; DB.setSettings({model:'lite'}); } } } applyTheme(); S.synced=true; BUS.emit('settings'); BUS.emit('sync'); });
  sub(m.query(DB.col('projects')),qs=>{ S.projects={}; qs.forEach(d=>S.projects[d.id]={id:d.id,...d.data()}); BUS.emit('projects'); });
  sub(m.query(DB.col('chats'),m.orderBy('updated','desc'),m.limit(200)),qs=>{ S.chats=qs.docs.map(d=>({id:d.id,...d.data()})); BUS.emit('chats'); });
  sub(m.query(DB.col('memories'),m.orderBy('at','desc'),m.limit(500)),qs=>{ S.memories=qs.docs.map(d=>({id:d.id,...d.data()})); BUS.emit('memories'); });
  sub(m.query(DB.col('library'),m.orderBy('at','desc'),m.limit(400)),qs=>{ S.library=qs.docs.map(d=>({id:d.id,...d.data()})); BUS.emit('library'); });
  sub(m.query(DB.col('schedules')),qs=>{ S.schedules=qs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.created||0)-(b.created||0)); BUS.emit('schedules'); });
  sub(m.query(DB.col('feed'),m.orderBy('at','desc'),m.limit(60)),qs=>{ S.feed=qs.docs.map(d=>({id:d.id,...d.data()})); BUS.emit('feed'); }); }
function curProject(){ return S.projects[S.curProject]||null; }
function setProject(id){ S.curProject=id||''; LS.set('curProject',S.curProject); BUS.emit('project'); }

/* ---------- チャット ---------- */
async function newChatDoc(kind='chat',title='新しいチャット'){ const id=uid(); const c={title,kind,project:S.curProject||'',created:Date.now(),updated:Date.now(),count:0}; await DB.put('chats',id,c,false); return id; }
async function addMsg(cid,msg){ const id=msg.id||uid(); const m={...msg,id,at:msg.at||Date.now()}; await DB.put(`chats/${cid}/msgs`,id,m,false); return id; }
async function delChat(cid){ try{ const qs=await FB.m.getDocs(DB.col('chats',cid,'msgs')); await Promise.all(qs.docs.map(d=>FB.m.deleteDoc(d.ref))); }catch(e){} await DB.del('chats',cid); }
async function chatMsgs(cid){ const qs=await FB.m.getDocs(FB.m.query(DB.col('chats',cid,'msgs'),FB.m.orderBy('at','asc'))); return qs.docs.map(d=>d.data()); }

/* ---------- テーマ ---------- */
function applyTheme(){ const t=S.settings.theme; const dark=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme=dark?'dark':'light'; document.body.classList.toggle('sideMini',!!S.settings.sideMini&&innerWidth>860); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
