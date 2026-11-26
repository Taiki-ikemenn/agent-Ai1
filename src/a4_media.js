/* ===== 画像・音楽・動画をつくる ===== */
const LIBCACHE={};
async function libSave(item,payload){ const id=item.id||uid(); const doc={...item,at:item.at||Date.now(),project:S.curProject||''}; delete doc.id; await DB.put('library',id,doc,false); if(payload){ LIBCACHE[id]=payload; await DB.put('libdata',id,payload,false); } return id; }
async function libData(id){ if(LIBCACHE[id]) return LIBCACHE[id]; try{ const s=await FB.m.getDoc(DB.doc('libdata',id)); if(s.exists()){ LIBCACHE[id]=s.data(); return LIBCACHE[id]; } }catch(e){} return null; }
async function libDelete(id){ await DB.del('library',id); try{ await DB.del('libdata',id); }catch(e){} delete LIBCACHE[id]; }
async function makeThumb(blob,max=320){ const b=await shrinkImage(blob,max,.72); return blobToDataURL(b); }

/* ---------- 画像 ---------- */
const ASPECT={'1:1':[1024,1024],'16:9':[1344,768],'9:16':[768,1344],'4:3':[1152,864],'3:4':[864,1152]};
async function genImage(prompt,{aspect='1:1',seed}={}){ const [w,hh]=ASPECT[aspect]||ASPECT['1:1']; let blob=null, via='';
  if(geminiKey().key&&!LS.get('noGemImg',0)){ try{ const j=await gemini('gemini-2.5-flash-image',{contents:[{role:'user',parts:[{text:prompt+`\n(aspect ratio ${aspect})`}]}],generationConfig:{responseModalities:['IMAGE','TEXT']}}); const p=((j.candidates&&j.candidates[0].content&&j.candidates[0].content.parts)||[]).find(x=>x.inlineData); if(p){ blob=b64ToBlob(p.inlineData.data,p.inlineData.mimeType||'image/png'); via='Gemini'; } }catch(e){ if(/quota|RESOURCE_EXHAUSTED|429|limit: 0/i.test(e.message)) LS.set('noGemImg',Date.now()); } }
  if(LS.get('noGemImg',0)&&Date.now()-LS.get('noGemImg',0)>6*3600e3) LS.del('noGemImg');
  if(!blob){ seed=seed||Math.floor(Math.random()*1e9); const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${hh}&seed=${seed}&nologo=true&model=flux`; for(let t=0;t<2&&!blob;t++){ try{ const r=await fetchT(url,60000); if(r.ok&&/image/.test(r.headers.get('content-type')||'')){ blob=await r.blob(); via='Pollinations'; } }catch(e){} if(!blob) await sleep(1500); } }
  if(!blob){ blob=await artFallback(prompt,w,hh); via='その場で描いた図形'; }
  return {blob:await shrinkImage(blob,1280,.86),via,w,h:hh}; }
async function artFallback(text,w,hh){ const c=h('canvas',{width:w,height:hh}); const x=c.getContext('2d'); let s=0; for(const ch of text) s=(s*31+ch.charCodeAt(0))>>>0; const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const hue=rnd()*360; const g=x.createLinearGradient(0,0,w,hh); g.addColorStop(0,`hsl(${hue},70%,55%)`); g.addColorStop(1,`hsl(${(hue+80)%360},70%,35%)`); x.fillStyle=g; x.fillRect(0,0,w,hh);
  for(let i=0;i<26;i++){ x.globalAlpha=.08+rnd()*.25; x.fillStyle=`hsl(${(hue+rnd()*140)%360},80%,${50+rnd()*30}%)`; x.beginPath(); x.arc(rnd()*w,rnd()*hh,20+rnd()*w*.25,0,7); x.fill(); } x.globalAlpha=1; return new Promise(ok=>c.toBlob(ok,'image/jpeg',.9)); }
function fetchT(url,ms=45000,opt={}){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return fetch(url,{...opt,signal:c.signal}).finally(()=>clearTimeout(t)); }
async function loadBitmap(src){ try{ const r=await fetchT(src,40000); if(!r.ok) return null; return await createImageBitmap(await r.blob()); }catch(e){ return null; } }

/* ---------- 音楽：AIが作曲 → ブラウザで演奏して WAV に ---------- */
const NOTE={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
function chordNotes(name){ const m=String(name).match(/^([A-G][#b]?)(maj7|m7|7|m|dim|sus4|sus2|add9)?/); if(!m) return [60,64,67]; const r=NOTE[m[1]]; const q=m[2]||''; const iv={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],dim:[0,3,6],sus4:[0,5,7],sus2:[0,2,7],add9:[0,4,7,14]}[q]||[0,4,7]; return iv.map(i=>48+r+i); }
async function composeMusic(desc,{seconds=40,mood='',tempo=0}={}){ const j=await geminiText(`次の希望に合う短い曲を作曲して、JSONだけ返して。希望：「${desc}」${mood?' 雰囲気：'+mood:''}
形式：{"title":"曲名(日本語)","bpm":${tempo||'60〜170の数'},"style":"pop|lofi|edm|rock|ambient|jazz|chiptune|cinematic|ballad のどれか","chords":["1小節ごとのコード(例 C, Am, F, G7, Em7)を8個"],"melody":[[拍(0〜31の数・小数可),長さ(拍),MIDI音番号(60〜84)],...20〜40個],"drums":true/false,"lead":"piano|bell|synth|square|pluck|strings のどれか"}`,{json:true});
  if(!j||!j.chords) throw new Error('作曲に失敗しました'); j.bpm=clamp(+j.bpm||110,50,180); j.seconds=clamp(seconds,10,120); j.desc=desc; return j; }
async function renderMusic(sc){ const sr=44100, bpm=sc.bpm, beat=60/bpm, bars=sc.chords.length, loopBeats=bars*4, total=Math.max(beat*4,sc.seconds); const ctx=new OfflineAudioContext(2,Math.ceil(sr*(total+1.5)),sr);
  const master=ctx.createGain(); master.gain.value=.55; const comp=ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  const rev=ctx.createConvolver(); const L=sr*2, ir=ctx.createBuffer(2,L,sr); for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<L;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/L,3); } rev.buffer=ir; const rg=ctx.createGain(); rg.gain.value=sc.style==='ambient'||sc.style==='cinematic'?.5:.22; rev.connect(rg); rg.connect(master);
  const noise=ctx.createBuffer(1,sr,sr); { const d=noise.getChannelData(0); for(let i=0;i<sr;i++) d[i]=Math.random()*2-1; }
  const f=m=>440*Math.pow(2,(m-69)/12);
  function tone(t,dur,midi,{type='triangle',vol=.2,a=.01,r=.25,pan=0,cut=0,wet=true,det=0}={}){ if(t>total) return; const o=ctx.createOscillator(); o.type=type; o.frequency.value=f(midi); o.detune.value=det; const g=ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+a); g.gain.setTargetAtTime(vol*.6,t+a,dur*.4); g.gain.setTargetAtTime(0,t+dur,r/3); let n=o; if(cut){ const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=cut; o.connect(fl); n=fl; } n.connect(g); const p=ctx.createStereoPanner(); p.pan.value=pan; g.connect(p); p.connect(master); if(wet) p.connect(rev); o.start(t); o.stop(t+dur+r+.1); }
  function kick(t){ const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(45,t+.12); g.gain.setValueAtTime(.9,t); g.gain.exponentialRampToValueAtTime(.001,t+.35); o.connect(g); g.connect(master); o.start(t); o.stop(t+.4); }
  function hit(t,{hp=6000,vol=.15,dec=.05}={}){ const s=ctx.createBufferSource(); s.buffer=noise; const fl=ctx.createBiquadFilter(); fl.type='highpass'; fl.frequency.value=hp; const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dec); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t+dec+.05); }
  const LEAD={piano:{type:'triangle',a:.005,r:.5,vol:.22},bell:{type:'sine',a:.002,r:1.2,vol:.2},synth:{type:'sawtooth',a:.02,r:.3,vol:.09,cut:2600},square:{type:'square',a:.005,r:.15,vol:.08,cut:3000},pluck:{type:'triangle',a:.002,r:.2,vol:.25},strings:{type:'sawtooth',a:.25,r:.8,vol:.07,cut:1800}}[sc.lead]||{type:'triangle',a:.005,r:.4,vol:.2};
  const st=sc.style; const loops=Math.ceil(total/(loopBeats*beat));
  for(let L2=0;L2<loops;L2++){ const base=L2*loopBeats*beat; const energy=L2===0?.6:1;
    sc.chords.forEach((ch,bi)=>{ const t0=base+bi*4*beat, ns=chordNotes(ch);
      // パッド
      ns.forEach((n,k)=>tone(t0,4*beat*.98,n+12,{type:st==='chiptune'?'square':'sine',vol:(st==='ambient'?.07:.045),a:st==='ambient'?.8:.08,r:.6,pan:(k-1)*.3,cut:1500}));
      // ベース
      const bp=st==='edm'||st==='rock'?[0,.5,1,1.5,2,2.5,3,3.5]:st==='ballad'||st==='ambient'?[0,2]:[0,1.5,2,3]; bp.forEach(b=>tone(t0+b*beat,beat*(st==='ambient'?1.9:.45),ns[0]-12,{type:st==='chiptune'?'square':'sawtooth',vol:.11*energy,cut:500,wet:false,r:.08}));
      // アルペジオ
      if(st!=='ambient'&&st!=='ballad'||L2>0) for(let s2=0;s2<8;s2++){ const n=ns[s2%ns.length]+(s2>=4?12:0)+12; tone(t0+s2*.5*beat,.45*beat,n,{type:st==='chiptune'?'square':'triangle',vol:.045*energy,pan:s2%2?.35:-.35,r:.15,cut:3500}); }
      // ドラム
      if(sc.drums!==false&&st!=='ambient'&&!(L2===0&&st==='ballad')) for(let b=0;b<4;b++){ const tb=t0+b*beat; if(st==='edm'||st==='rock'||b%2===0) kick(tb); if(b%2===1) hit(tb,{hp:1500,vol:.35,dec:.16}); hit(tb,{vol:.1}); hit(tb+beat/2,{vol:.07}); if(st==='lofi'&&b===3) hit(tb+beat*.75,{vol:.05}); }
    });
    // メロディ（2回目からは1オクターブ上を少し混ぜる）
    (sc.melody||[]).forEach(([b,d,n])=>{ if(b>=loopBeats) return; tone(base+b*beat,Math.max(.1,d*beat),clamp(n,48,96),{...LEAD,pan:.05}); if(L2%2===1) tone(base+b*beat,Math.max(.1,d*beat),clamp(n,48,96)+12,{...LEAD,vol:LEAD.vol*.35}); });
  }
  master.gain.setValueAtTime(.55,total-1.2); master.gain.linearRampToValueAtTime(0,total+.8);
  return ctx.startRendering(); }
function wavBlob(buf){ const ch=buf.numberOfChannels, len=buf.length, sr=buf.sampleRate; const ab=new ArrayBuffer(44+len*ch*2), v=new DataView(ab); const w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+len*ch*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true); v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,len*ch*2,true);
  const data=[]; for(let c=0;c<ch;c++) data.push(buf.getChannelData(c)); let o=44; for(let i=0;i<len;i++) for(let c=0;c<ch;c++){ const s=clamp(data[c][i],-1,1); v.setInt16(o,s<0?s*32768:s*32767,true); o+=2; } return new Blob([ab],{type:'audio/wav'}); }
const MUSICCACHE={};
async function musicBlob(id,score){ if(MUSICCACHE[id]) return MUSICCACHE[id]; const b=wavBlob(await renderMusic(score)); MUSICCACHE[id]=b; return b; }

/* ---------- 動画：AIの画像＋文字＋音楽をブラウザで組み立てる ---------- */
async function planVideo(topic,{scenes=5,vertical=false,style=''}={}){ const j=await geminiText(`「${topic}」の短い動画の台本をJSONだけで返して。${style?'雰囲気：'+style:''}
形式：{"title":"動画のタイトル","music":"BGMのイメージ(日本語)","scenes":[{"caption":"画面に出す短い日本語(20文字まで)","sub":"小さい補足(30文字まで・なくてもよい)","image":"その場面の画像を作るための英語のプロンプト(cinematic, detailed)","sec":3〜5の数}]} 場面は${scenes}個。`,{json:true});
  if(!j||!j.scenes) throw new Error('台本を作れませんでした'); j.vertical=vertical; j.scenes=j.scenes.slice(0,10).map(s=>({...s,sec:clamp(+s.sec||4,2,8),seed:Math.floor(Math.random()*1e9)})); return j; }
function sceneURL(s,vertical){ const [w,hh]=vertical?[720,1280]:[1280,720]; return `https://image.pollinations.ai/prompt/${encodeURIComponent(s.image)}?width=${w}&height=${hh}&seed=${s.seed}&nologo=true&model=flux`; }
async function renderVideo(plan,{onProgress,withMusic=true,actx:givenCtx}={}){ const [W,H]=plan.vertical?[720,1280]:[1280,720]; const c=h('canvas',{width:W,height:H}); const x=c.getContext('2d');
  onProgress&&onProgress('画像を集めています',0); const imgs=[]; for(let i=0;i<plan.scenes.length;i++){ const s=plan.scenes[i]; let b=s.lib?await libData(s.lib).then(d=>d&&d.data?loadBitmap(d.data):null):await loadBitmap(sceneURL(s,plan.vertical)); if(!b) b=await createImageBitmap(await artFallback(s.caption||plan.title,W,H)); imgs.push(b); onProgress&&onProgress('画像を集めています',(i+1)/plan.scenes.length*.4); }
  const total=plan.scenes.reduce((a,s)=>a+s.sec,0); let audioStream=null, actx=null, abuf=null;
  if(withMusic){ try{ onProgress&&onProgress('BGMを作っています',.42); const score=plan.score||(plan.score=await composeMusic(plan.music||plan.title,{seconds:total+1})); score.seconds=total+1; abuf=await renderMusic(score); actx=givenCtx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state!=='running') await Promise.race([actx.resume(),sleep(800)]); if(actx.state!=='running') throw new Error('音を出せない状態です'); const dst=actx.createMediaStreamDestination(); audioStream=dst; plan._dst=dst; }catch(e){ console.warn(e); audioStream=null; abuf=null; } }
  const fps=30; const vs=c.captureStream(fps); const tracks=[...vs.getVideoTracks()]; if(audioStream) tracks.push(...audioStream.stream.getAudioTracks());
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1,mp4a','video/mp4'].find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
  const rec=new MediaRecorder(new MediaStream(tracks),mime?{mimeType:mime,videoBitsPerSecond:5e6}:{}); const chunks=[]; rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const done=new Promise(ok=>rec.onstop=ok); rec.start(250);
  if(abuf&&actx){ const src=actx.createBufferSource(); src.buffer=abuf; src.connect(audioStream); src.start(); }
  const t0=performance.now(); const fsz=Math.round(W*(plan.vertical?.075:.05));
  const draw=now=>{ const t=(now-t0)/1000; let acc=0, i=0; while(i<plan.scenes.length-1&&t>acc+plan.scenes[i].sec){ acc+=plan.scenes[i].sec; i++; } const s=plan.scenes[i], lt=t-acc, p=clamp(lt/s.sec,0,1);
    const paint=(img,k,alpha)=>{ const sc=1.06+.08*k; const r=Math.max(W/img.width,H/img.height)*sc; const iw=img.width*r, ih=img.height*r; x.globalAlpha=alpha; x.drawImage(img,(W-iw)/2+(i%2?-1:1)*k*W*.03,(H-ih)/2,iw,ih); x.globalAlpha=1; };
    x.fillStyle='#000'; x.fillRect(0,0,W,H); paint(imgs[i],p,1); if(lt<.6&&i>0) paint(imgs[i-1],1,1-lt/.6);
    const g=x.createLinearGradient(0,H*.55,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.72)'); x.fillStyle=g; x.fillRect(0,H*.5,W,H*.5);
    const ap=clamp((lt-.2)/.5,0,1); x.globalAlpha=ap; x.fillStyle='#fff'; x.font=`800 ${fsz}px "Hiragino Sans","Noto Sans JP",sans-serif`; x.textAlign='center'; x.shadowColor='rgba(0,0,0,.5)'; x.shadowBlur=18; x.fillText(s.caption||'',W/2,H*(plan.vertical?.8:.82)+(1-ap)*20);
    if(s.sub){ x.font=`500 ${Math.round(fsz*.5)}px "Hiragino Sans","Noto Sans JP",sans-serif`; x.fillStyle='rgba(255,255,255,.86)'; x.fillText(s.sub,W/2,H*(plan.vertical?.8:.82)+fsz*.95); } x.shadowBlur=0; x.globalAlpha=1;
    if(i===0&&lt<2.2){ const a2=lt<1.6?1:1-(lt-1.6)/.6; x.globalAlpha=a2*.9; x.fillStyle='rgba(15,21,36,.55)'; x.fillRect(0,0,W,H); x.globalAlpha=a2; x.fillStyle='#fff'; x.font=`900 ${Math.round(fsz*1.25)}px "Hiragino Sans","Noto Sans JP",sans-serif`; x.fillText(plan.title||'',W/2,H/2); x.globalAlpha=1; }
    x.fillStyle='rgba(255,255,255,.85)'; x.fillRect(0,H-6,W*clamp(t/total,0,1),6);
    onProgress&&onProgress('動画を書き出しています',.45+.55*clamp(t/total,0,1));
    if(t<total+.3) requestAnimationFrame(draw); else rec.stop(); };
  requestAnimationFrame(draw); await done; try{ actx&&actx.close(); }catch(e){}
  return new Blob(chunks,{type:(mime||'video/webm').split(';')[0]}); }
const VIDEOCACHE={};
