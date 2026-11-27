/* ===== Gemini（AIの頭脳） ===== */
// キーはアカウントに保存しない。同じサイトのほかのアプリ（Home XR OS・ぼくといっしょ・NaviX）からこの端末の中で読み取る
const KEYSRC=[['xr_cfg','Home XR OS',v=>v&&v.aiKey],['chara_cfg','ぼくといっしょ',v=>v&&v.key],['navix_ai','NaviX',v=>v&&v.key]];
function geminiKey(){ const own=LS.get('gkey',''); if(own) return {key:own,from:'この端末に入力したキー'};
  for(const [k,name,f] of KEYSRC){ try{ const v=f(JSON.parse(localStorage.getItem(k)||'null')); if(v&&/^(AIza|AQ\.)/.test(v.trim())) return {key:v.trim(),from:name}; }catch(e){} }
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith('agentai_')) continue; const v=localStorage.getItem(k)||''; const m=v.match(/AIza[0-9A-Za-z_\-]{35}|AQ\.[0-9A-Za-z_\-.]{30,}/); if(m&&m[0]!==FB_CONFIG.apiKey) return {key:m[0],from:'ほかのアプリ（'+k+'）'}; }
  return {key:'',from:''}; }
// モデルは「役割」で選び、そのとき使える最新のモデルを自動で探す（Googleがモデルを入れかえても動くように）
const MODELS=[{v:'lite',t:'標準',s:'Gemini 3.5 Flash-Lite・無料で使えるモデル',icon:'zap'},{v:'fast',t:'かしこい',s:'最新の Flash（使えないときは標準に自動で切りかえ）',icon:'sparkles'},{v:'pro',t:'じっくり',s:'最新の Pro（使えないときは標準に自動で切りかえ）',icon:'brain'}];
const roleOf=m=>{ m=String(m||'lite'); if(['fast','pro','lite'].includes(m)) return m; return /lite/.test(m)?'lite':/pro/.test(m)?'pro':'fast'; };
const GBASE='https://generativelanguage.googleapis.com/v1beta/models/';
const MODEL={list:null,work:LS.get('modelWork',{}),bad:LS.get('modelBad',{})};
const BASE_MODEL='gemini-3.5-flash-lite';
async function listModels(){ const c=LS.get('modelList',null); if(c&&Date.now()-c.at<6*3600e3&&c.key===geminiKey().key.slice(-6)) return c.list;
  try{ const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':geminiKey().key}}); const j=await r.json(); if(!r.ok) throw 0;
    const list=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,'')); LS.set('modelList',{at:Date.now(),list,key:geminiKey().key.slice(-6)}); return list; }catch(e){ return c?c.list:[]; } }
const verOf=n=>{ const m=n.match(/gemini-(\d+)(?:\.(\d+))?/); return m?(+m[1])*100+(+(m[2]||0)):0; };
async function modelChain(role){ const list=await listModels(); const has=n=>!list.length||list.includes(n);
  const pick=re=>list.filter(n=>re.test(n)&&verOf(n)>=300&&!/(image|tts|audio|live|embed|native|computer|robotic|learnlm|aqa)/.test(n)).sort((a,b)=>verOf(b)-verOf(a)||(/preview|exp/.test(a)?1:0)-(/preview|exp/.test(b)?1:0));
  const flash=['gemini-flash-latest',...pick(/^gemini-[\d.]+-flash(-preview[\w-]*)?$/)].filter(has), lite=['gemini-flash-lite-latest',...pick(/^gemini-[\d.]+-flash-lite(-preview[\w-]*)?$/)].filter(has), pro=['gemini-pro-latest',...pick(/^gemini-[\d.]+-pro(-preview[\w-]*)?$/)].filter(has);
  const base=[BASE_MODEL].filter(has); let ch=role==='pro'?[...pro,...flash,...base,...lite]:role==='fast'?[...flash,...base,...lite]:[...base,...lite,...flash]; if(!ch.length) ch=[BASE_MODEL,'gemini-flash-lite-latest'];
  ch=[...new Set(ch)].filter(n=>!/gemini-[12]\./.test(n)); const ok=ch.filter(n=>!(MODEL.bad[n]>Date.now())); ch=ok.length?ok:ch; const w=MODEL.work[role]; if(w&&ch.includes(w)) ch=[w,...ch.filter(n=>n!==w)]; return ch; }
async function imageModels(){ const list=await listModels(); return list.filter(n=>/flash.*image|image.*flash/.test(n)&&verOf(n)>=300).sort((a,b)=>verOf(b)-verOf(a)).slice(0,2); }
async function geminiRaw(model,body,signal){ const k=geminiKey().key; if(!k) throw new Error('NOKEY');
  const r=await fetch(GBASE+encodeURIComponent(model)+':generateContent',{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':k},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({})); if(!r.ok){ const er=j.error||{}; const e=new Error(er.message||('HTTP '+r.status)); e.status=r.status; e.model=model; const ri=(er.details||[]).find(d=>/RetryInfo/.test(d['@type']||'')); e.retry=ri?parseFloat(ri.retryDelay)||0:0; e.daily=/PerDay|per day|_day/i.test(JSON.stringify(er)); e.zero=/limit: 0\b|limit:0\b/.test(er.message||''); throw e; } return j; }
// 文字を少しずつ受けとる（SSE）。部品はまとめなおして、関数呼び出しの署名も保つ
async function geminiStreamRaw(model,body,signal,onDelta){ const k=geminiKey().key; if(!k) throw new Error('NOKEY');
  const r=await fetch(GBASE+encodeURIComponent(model)+':streamGenerateContent?alt=sse',{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':k},body:JSON.stringify(body)});
  if(!r.ok){ const j=await r.json().catch(()=>({})); const er=(Array.isArray(j)?j[0]:j).error||{}; const e=new Error(er.message||('HTTP '+r.status)); e.status=r.status; e.model=model; const ri=(er.details||[]).find(d=>/RetryInfo/.test(d['@type']||'')); e.retry=ri?parseFloat(ri.retryDelay)||0:0; e.daily=/PerDay|per day|_day/i.test(JSON.stringify(er)); e.zero=/limit: 0\b|limit:0\b/.test(er.message||''); throw e; }
  if(!r.body||!r.body.getReader){ const t=await r.text(); return parseSSE(t,onDelta); }
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='', st={parts:[],finish:'',gm:null,text:''};
  for(;;){ const {done,value}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); let i; while((i=buf.indexOf('\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(line.startsWith('data:')) sseChunk(line.slice(5).trim(),st,onDelta); } }
  if(buf.trim().startsWith('data:')) sseChunk(buf.trim().slice(5).trim(),st,onDelta);
  return {candidates:[{content:{role:'model',parts:st.parts},finishReason:st.finish,groundingMetadata:st.gm}]}; }
function parseSSE(t,onDelta){ const st={parts:[],finish:'',gm:null,text:''}; t.split('\n').forEach(l=>{ l=l.trim(); if(l.startsWith('data:')) sseChunk(l.slice(5).trim(),st,onDelta); }); return {candidates:[{content:{role:'model',parts:st.parts},finishReason:st.finish,groundingMetadata:st.gm}]}; }
function sseChunk(s,st,onDelta){ if(!s||s==='[DONE]') return; let j; try{ j=JSON.parse(s); }catch(e){ return; } const c=j.candidates&&j.candidates[0]; if(!c) return; if(c.finishReason) st.finish=c.finishReason; if(c.groundingMetadata) st.gm=c.groundingMetadata;
  for(const p of ((c.content&&c.content.parts)||[])){ const last=st.parts[st.parts.length-1]; const isT=x=>x&&x.text!=null&&!x.functionCall;
    if(isT(p)&&isT(last)&&!!p.thought===!!last.thought){ last.text+=p.text; if(p.thoughtSignature) last.thoughtSignature=p.thoughtSignature; } else st.parts.push({...p});
    if(p.text&&!p.thought){ st.text+=p.text; onDelta&&onDelta(st.text); } } }
// 役割（fast/pro/lite）かモデル名を受けとり、だめなら次のモデルへ。
// 1分あたりの回数オーバーは、まず別のモデル（回数は別々）を試し、全部だめなら少し待ってもう一周
async function gemini(roleOrModel,body,signal,{maxWait=25,rounds=2,stream}={}){ const role=roleOf(roleOrModel); const chain=['fast','pro','lite'].includes(roleOrModel)||/^gemini-[12]\./.test(roleOrModel)?await modelChain(role):[roleOrModel]; let last;
  const grounding=/google_search|url_context/.test(JSON.stringify(body.tools||[])); // 検索の上限でモデル自体を「使えない」と覚えないように
  const mark=(m,ms)=>{ if(grounding) return; MODEL.bad[m]=Date.now()+ms; LS.set('modelBad',MODEL.bad); };
  for(let r=0;r<rounds;r++){ let wait=0, tried=0;
    for(const m of chain){ if(MODEL.bad[m]>Date.now()&&chain.some(x=>!(MODEL.bad[x]>Date.now()))) continue; tried++;
      for(let t=0;t<2;t++){ try{ const j=stream?await geminiStreamRaw(m,body,signal,stream):await geminiRaw(m,body,signal); if(MODEL.work[role]!==m&&!grounding){ MODEL.work[role]=m; LS.set('modelWork',MODEL.work); BUS.emit('model'); } return j; }
        catch(e){ last=e; if(e.name==='AbortError'||e.message==='NOKEY'||/API key|API_KEY|PERMISSION_DENIED|UNAUTHENTICATED/i.test(e.message)) throw e;
          if(e.status===404||(e.status===400&&/not (found|supported)|unsupported model|is not available/i.test(e.message))){ mark(m,24*3600e3); break; }
          if(e.status===429){ if(e.zero) mark(m,24*3600e3); else if(e.daily) mark(m,30*60e3); else wait=Math.max(wait,e.retry||6); break; }
          if(e.status>=500&&t<1){ await sleep(2000); continue; } if(e.status>=500) break; throw e; } } }
    if(!wait||r===rounds-1) break; const w=Math.min(maxWait,Math.max(3,wait)); BUS.emit('wait',w); await sleep(w*1000); }
  throw last||new Error('使えるモデルが見つかりません'); }
async function geminiText(prompt,{model,sys,json=false,signal,tools,maxWait,rounds}={}){ const body={contents:[{role:'user',parts:[{text:prompt}]}]}; if(sys) body.systemInstruction={parts:[{text:sys}]}; if(json&&!tools) body.generationConfig={responseMimeType:'application/json'}; if(tools) body.tools=tools;
  const j=await gemini(model||S.settings.model||'lite',body,signal,{maxWait,rounds}); const c=j.candidates&&j.candidates[0]; const t=((c&&c.content&&c.content.parts)||[]).filter(p=>!p.thought).map(p=>p.text||'').join(''); if(json){ try{ return JSON.parse(t.replace(/^\s*```(json)?|```\s*$/g,'')); }catch(e){ const m=t.match(/[\[{][\s\S]*[\]}]/); return m?JSON.parse(m[0]):null; } } return {text:t,cand:c}; }
function errText(e){ const m=String(e&&e.message||e); if(m==='NOKEY') return 'Geminiのキーが見つかりません。カスタマイズ → 一般 で確認してください。'; if(e&&e.name==='AbortError') return '止めました。';
  if(/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|invalid authentication/i.test(m)) return 'Geminiのキーが使えないようです（'+m.slice(0,120)+'）。キーを確認してください。';
  if(e&&e.status===429||/quota|RESOURCE_EXHAUSTED/i.test(m)) return (e&&e.daily?'今日のGeminiの無料回数を使い切ったようです（日本時間の夕方5時ごろにリセット）。':'Geminiが混み合っているか、短い時間に呼びすぎました。1分ほど待ってからもう一度ためしてください。')+'\n（くわしく：'+(e&&e.model?e.model+' / ':'')+m.slice(0,160)+'）';
  return 'エラー：'+m.slice(0,300); }

/* ---------- システムへの指示 ---------- */
function sysPrompt(extra=''){ const st=S.settings, ins=st.instr||{}, p=curProject(); const now=new Date();
  const len=ins.length<34?'短く要点だけ':ins.length>66?'くわしく丁寧に':'ちょうどよい長さで', form=ins.formality<34?'くだけた話し方':ins.formality>66?'丁寧語（です・ます）':'やわらかい丁寧語', det=ins.detail<34?'結論を先に':'理由や手順も示して';
  const mems=st.memoryOn?S.memories.filter(m=>!m.project||m.project===(p&&p.id)).slice(0,60).map(m=>'- '+m.text).join('\n'):'';
  const conns=connStatusList().filter(c=>c.ok).map(c=>c.name).join('、');
  return `あなたは「エージェントAi」。ユーザーの作業を実際に手伝うAIエージェントです。会話だけで終わらせず、必要なら道具（関数）を使って調べる・作る・保存する・送るところまで進めてください。
今日は ${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${'日月火水木金土'[now.getDay()]}）${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}。ユーザーの地域：${(st.conn.weather&&st.conn.weather.place)||'日本'}。
返答の言語：${ins.lang==='en'?'英語':'日本語'}。話し方：${form}。長さ：${len}。${det}。絵文字は使わない。
最新の情報・ニュース・値段・人物などは推測せず web_search で調べ、出典を示す。ファイルやコードを渡すときは必ず create_file を呼ぶ（呼ばずに「ファイルを作りました」「ダウンロードできます」と言ってはいけない）。画像・音楽・動画は create_image / create_music / create_video を使う。既存の曲を聴きたいときは spotify_search（なければ youtube_search）でプレーヤーを出す。
大事な前提があいまいなとき（好みや条件で結果が大きく変わる作業）は、作り始める前に ask_user で選択肢つきの質問をまとめて聞く（ふつうの雑談では聞かない）。
ユーザーについて長く役立つ事実（好み・家族・持ち物・目標など）を知ったら memory_save で覚える。ほかのチャットの内容が必要なら search_chats を使う。
メールの送信・ファイルの上書き・GitHubへの書きこみなど、取り消しにくい操作は、内容を見せて確認を取ってから行う。
使えるアプリ接続：${conns||'なし'}。
${ins.about?'ユーザーについて（本人が書いたもの）：\n'+ins.about+'\n':''}${ins.style?'返答のしかたの希望：\n'+ins.style+'\n':''}${p?`いまのプロジェクト「${p.name}」\n${p.instr||''}\n`:''}${mems?'覚えていること（メモリー）：\n'+mems+'\n':''}${extra}`; }

/* ---------- 会話の履歴をGeminiの形にする ---------- */
async function toContents(msgs){ const out=[]; for(const m of msgs){ if(m.role==='user'){ const parts=[]; for(const a of (m.atts||[])){ const p=await attPart(a); if(p) parts.push(p); } parts.push({text:m.text||'（ファイルを送りました）'}); out.push({role:'user',parts}); }
    else if(m.role==='model'){ let t=m.text||''; if(m.files&&m.files.length) t+='\n（作ったファイル：'+m.files.map(f=>f.name).join('、')+'）'; if(m.media&&m.media.length) t+='\n（作ったもの：'+m.media.map(x=>x.name||x.kind).join('、')+'）'; out.push({role:'model',parts:[{text:t||'…'}]}); } }
  // 同じ役割が続くとエラーになるのでまとめる
  const merged=[]; out.forEach(c=>{ const l=merged[merged.length-1]; if(l&&l.role===c.role) l.parts.push(...c.parts); else merged.push(c); }); if(merged[0]&&merged[0].role!=='user') merged.unshift({role:'user',parts:[{text:'（つづき）'}]}); return merged; }
async function attPart(a){ try{ if(a.text!=null) return {text:`【ファイル：${a.name}】\n${a.text.slice(0,200000)}`}; let data=a.data; if(!data){ const b=await IDB.get('att_'+a.id); if(b) data=await blobToB64(b); } if(!data){ try{ const d=await FB.m.getDoc(DB.doc('atts',a.id)); if(d.exists()) data=d.data().data; }catch(e){} } if(!data) return {text:`【ファイル：${a.name}（この端末にないため読めません）】`}; return {inlineData:{mimeType:a.mime,data:data.replace(/^data:[^,]+,/,'')}}; }catch(e){ return null; } }

/* ---------- エージェントの動き（考える→道具→たしかめる→答える） ---------- */
function codeBlocksToFiles(res){ const ext={html:'html',htm:'html',css:'css',javascript:'js',js:'js',python:'py',py:'py',json:'json',svg:'svg',markdown:'md',md:'md',csv:'csv',txt:'txt',text:'txt',ts:'ts',typescript:'ts'}; let n=0;
  for(const m of String(res.text).matchAll(/```\s*([\w+#.-]*)[^\n]*\n([\s\S]*?)```/g)){ const lang=(m[1]||'txt').toLowerCase(); const e=ext[lang]||'txt'; const content=m[2].replace(/\n$/,''); if(content.length<20) continue; n++; const name=(e==='html'&&!res.files.some(f=>f.name==='index.html'))?'index.html':`file${n}.${e}`; res.files.push({name,content,size:new Blob([content]).size,note:'返事の中のコードから作りました'}); } }
async function runAgent({msgs,onStep,onText,signal,extraSys='',ctx={},maxRounds=12,toolFilter,force=[]}){ const model=S.settings.model||'lite';
  const decls=toolDecls(toolFilter); force=force.filter(n=>decls.some(d=>d.name===n)); if(force.length) extraSys+=`\nユーザーは @ で道具を指定しました。必ず次の道具を使って答えること：${force.join('、')}`; const contents=await toContents(msgs); const sys=sysPrompt(extraSys); const res={text:'',files:[],media:[],sources:[],steps:[],cards:[],actions:[]};
  ctx={...ctx,res,signal};
  let nudge=false, nudged=false, promised='';
  for(let round=0;round<maxRounds;round++){ let j;
    try{ j=await gemini(model,{contents,systemInstruction:{parts:[{text:sys}]},tools:decls.length?[{functionDeclarations:decls}]:undefined,generationConfig:{temperature:.7},toolConfig:(round===0&&force.length)?{functionCallingConfig:{mode:'ANY',allowedFunctionNames:force}}:nudge?{functionCallingConfig:{mode:'ANY',allowedFunctionNames:['create_file']}}:undefined},signal,{stream:t=>onText&&onText(t,round)}); }
    catch(e){ throw e; }
    const cand=j.candidates&&j.candidates[0]; const parts=(cand&&cand.content&&cand.content.parts)||[]; const calls=parts.filter(p=>p.functionCall);
    const txt=parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('');
    nudge=false;
    if(!calls.length){ const said=/(ファイル|\.(html?|js|css|py|txt|md|csv|json|svg))[^。\n]{0,30}(作り|作成|用意|保存し|まとめ)|ダウンロード(して|でき|ボタン)/.test(txt||'');
      if(said&&!res.files.length&&!nudged&&decls.some(d=>d.name==='create_file')){ nudged=true; nudge=true; promised=txt; contents.push({role:'model',parts:[{text:txt}]},{role:'user',parts:[{text:'（システム）ファイルを作ると言いましたが、まだ create_file を呼んでいません。今すぐ create_file で、言ったとおりのファイルを中身まで全部作ってください。'}]}); continue; }
      res.text=promised&&res.files.length?promised:(txt||promised||(cand&&cand.finishReason==='SAFETY'?'この内容にはお答えできません。':res.text||''));
      if(said&&!res.files.length) codeBlocksToFiles(res);
      return res; }
    contents.push({role:'model',parts});
    const outs=await Promise.all(calls.map(async p=>{ const fc=p.functionCall; const t=TOOLS[fc.name]; const step={name:fc.name,label:t?t.label(fc.args||{}):fc.name,icon:t?t.icon:'wrench',status:'run',args:fc.args}; res.steps.push(step); onStep&&onStep(res.steps);
      let out; try{ if(!t) throw new Error('この道具はありません'); out=await t.run(fc.args||{},ctx); step.status='ok'; }catch(e){ out={error:String(e&&e.message||e)}; step.status='err'; }
      step.result=typeof out==='string'?out.slice(0,1500):JSON.stringify(out).slice(0,1500); onStep&&onStep(res.steps); return {functionResponse:{name:fc.name,response:typeof out==='object'&&!Array.isArray(out)?out:{result:out}}}; }));
    contents.push({role:'user',parts:outs}); if(signal&&signal.aborted) throw new DOMException('aborted','AbortError'); }
  res.text=res.text||'作業が長くなったので、いったんここで止めました。続けるときは「続けて」と送ってください。'; return res; }
