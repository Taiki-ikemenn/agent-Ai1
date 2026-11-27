/* ===== 音声会話モード ===== */
const plainSpeech=t=>String(t||'').replace(/```[\s\S]*?```/g,'（コードは画面を見てね）').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[#*_`>|~]/g,'').replace(/\n{2,}/g,'。').replace(/\s+/g,' ').trim();
function voiceMode(view){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){ toast('この端末・ブラウザは音声入力に対応していません（Safari / Chrome で開いてね）','x',4500); return; } if(!geminiKey().key){ keyHelp(); return; }
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); }catch(e){}
  let state='idle', rec=null, alive=true, muted=false;
  const ov=h('div',{class:'voice'}); const orb=h('div',{class:'vOrb',html:'<i></i><i></i><i></i>'}); const st=h('div',{class:'vState'},'準備中'); const said=h('div',{class:'vSaid'}); const reply=h('div',{class:'vReply'});
  const muteB=h('button',{class:'vBtn',title:'マイクを止める',html:ic('mic')}); const endB=h('button',{class:'vBtn end',title:'終わる',html:ic('x')}); const skipB=h('button',{class:'vBtn',title:'読み上げをとばす',html:ic('skip-forward')});
  ov.append(h('div',{class:'vTop',html:`<b>音声会話</b><small>話しかけてね。終わるときは × を押す</small>`}),orb,st,said,reply,h('div',{class:'vBar'},muteB,skipB,endB)); document.body.append(ov);
  const set=(s,t)=>{ state=s; ov.dataset.state=s; st.textContent=t; };
  const listen=()=>{ if(!alive) return; if(muted){ set('muted','マイクは止まっています'); return; } said.textContent=''; set('listen','聞いています…'); rec=new SR(); rec.lang='ja-JP'; rec.interimResults=true; rec.continuous=false; let final='';
    rec.onresult=e=>{ let t=''; for(const r of e.results){ t+=r[0].transcript; if(r.isFinal) final=t; } said.textContent=t; };
    rec.onerror=e=>{ if(e.error==='not-allowed'){ set('err','マイクが許可されていません'); return; } };
    rec.onend=()=>{ rec=null; if(!alive) return; const t=(final||said.textContent).trim(); if(t) ask(t); else if(state==='listen') setTimeout(listen,300); };
    try{ rec.start(); }catch(e){ setTimeout(listen,600); } };
  const ask=async t=>{ set('think','考えています…'); reply.textContent=''; const off=BUS.on('answered',({text})=>{ off(); speakOut(text); }); try{ await view.submit(t); }catch(e){} if(state==='think'){ off(); set('err','うまくいきませんでした。もう一度話してね'); setTimeout(listen,1800); } };
  const speakOut=text=>{ if(!alive) return; const p=plainSpeech(text); reply.textContent=p.slice(0,400); if(!p){ listen(); return; } set('speak','話しています'); speechSynthesis.cancel(); const parts=p.match(/[^。！？!?]+[。！？!?]?/g)||[p]; let k=0;
    const next=()=>{ if(!alive||state!=='speak') return; if(k>=parts.length){ listen(); return; } const u=new SpeechSynthesisUtterance(parts[k++]); u.lang='ja-JP'; u.rate=1.08; const v=speechSynthesis.getVoices().find(x=>/ja/i.test(x.lang)&&/Kyoko|O-ren|Google|Siri/i.test(x.name))||speechSynthesis.getVoices().find(x=>/ja/i.test(x.lang)); if(v) u.voice=v; u.onend=next; u.onerror=next; speechSynthesis.speak(u); }; next(); };
  muteB.onclick=()=>{ muted=!muted; muteB.innerHTML=ic(muted?'mic-off':'mic'); muteB.classList.toggle('on',muted); if(muted){ rec&&rec.abort(); set('muted','マイクは止まっています'); } else listen(); };
  skipB.onclick=()=>{ if(state==='speak'){ speechSynthesis.cancel(); state='x'; listen(); } };
  const close=()=>{ alive=false; try{ rec&&rec.abort(); }catch(e){} speechSynthesis.cancel(); ov.classList.add('out'); setTimeout(()=>ov.remove(),260); }; endB.onclick=close;
  orb.onclick=()=>{ if(state==='speak'){ speechSynthesis.cancel(); state='x'; listen(); } else if(state==='listen'){ rec&&rec.stop(); } else if(state==='muted'){ muteB.click(); } };
  setTimeout(listen,350); }
/* ===== 会話のまとめ（ログ） ===== */
async function chatSummary(c,{force=false,silent=false}={}){ let close=null, body=null;
  if(!silent) close=modal((m,cl)=>{ m.append(h('div',{class:'row',style:'margin-bottom:6px'},h('div',{style:'width:36px;height:36px;border-radius:11px;background:var(--accSoft);color:var(--acc);display:grid;place-items:center',html:ic('scroll-text')}),h('div',{style:'flex:1;min-width:0',html:`<h3 style="margin:0">会話のまとめ</h3><small class="muted">${esc(c.title||'')}</small>`}))); body=h('div',{class:'logBody'}); m.append(body); },{wide:true});
  const paint=(log)=>{ if(!body) return; body.innerHTML=''; body.append(md(log.text)); if(log.made&&log.made.length){ body.append(h('h3',{style:'font-size:15px;margin:14px 0 6px'},'作ったもの')); const l=h('div',{class:'row',style:'flex-wrap:wrap;gap:6px'}); log.made.forEach(x=>l.append(h('span',{class:'chip',html:ic(fileIcon(x))+esc(x)}))); body.append(l); }
    const f=h('div',{class:'modalFoot'}); f.append(h('small',{class:'muted',style:'margin-right:auto'},fmtDT(log.at)+' に作成'),h('button',{class:'btn ghost',html:ic('rotate-ccw')+'作り直す',onclick:()=>{ close&&close(); chatSummary(c,{force:true}); }}),h('button',{class:'btn',html:ic('copy')+'コピー',onclick:()=>navigator.clipboard.writeText(log.text).then(()=>toast('コピーしました','check'))}),h('button',{class:'btn pri',html:ic('download')+'保存',onclick:()=>downloadText(`# ${c.title}\n\n${log.text}`,(c.title||'chat')+'_まとめ.md')})); body.append(f); };
  if(c.log&&!force&&c.log.at>=(c.updated||0)-1000){ paint(c.log); return c.log; }
  if(body) body.append(h('div',{class:'thinking',style:'padding:20px 0',html:'<i><span></span><span></span><span></span></i>まとめています'}));
  try{ const ms=await chatMsgs(c.id); const made=[...new Set(ms.flatMap(m=>[...(m.files||[]).map(f=>f.name),...(m.media||[]).map(x=>x.name)]).filter(Boolean))];
    const conv=ms.map(m=>(m.role==='user'?'ユーザー：':'AI：')+(m.text||'').replace(/```[\s\S]*?```/g,'（コード）').slice(0,1500)).join('\n').slice(-30000);
    const r=await geminiText(`次の会話の「作業ログ」を日本語のMarkdownで作って。見出しは次の4つだけ：\n## ひとことで\n（1文）\n## やったこと\n（箇条書き）\n## 決めたこと・わかったこと\n（箇条書き）\n## 次にやること\n（箇条書き、なければ「なし」）\n\n会話：\n${conv}`,{model:'lite'});
    const log={text:r.text.trim(),made,at:Date.now()}; await DB.put('chats',c.id,{log}); paint(log); return log; }
  catch(e){ if(body){ body.innerHTML=''; body.append(h('p',{style:'white-space:pre-wrap'},errText(e))); } return null; } }
/* ---------- 日ごとの作業ログ ---------- */
PAGES.log=pg=>{ topBar('作業ログ',{icon:'scroll-text'}); const w=h('div',{class:'wrap',style:'max-width:860px'}); pg.append(w); w.append(h('div',{class:'pageHead',html:'<h2>作業ログ</h2><p>日ごとに、話したチャット・作ったもの・スケジュールの実行・終わったToDoをまとめて見られます。チャットの「会話のまとめ」もここから作れます。</p>'}));
  const list=h('div'); w.append(list);
  const paint=()=>{ list.innerHTML=''; const days={}; const add=(t,item)=>{ const d=new Date(t); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; (days[k]=days[k]||{chats:[],lib:[],runs:[],todo:[]})[item.type].push(item); };
    S.chats.forEach(c=>c.updated&&add(c.updated,{type:'chats',c})); S.library.forEach(x=>add(x.at,{type:'lib',x})); S.schedules.forEach(s=>(s.runs||[]).forEach(r=>add(r.at,{type:'runs',s,r}))); (S.todos||[]).filter(t=>t.done&&t.doneAt).forEach(t=>add(t.doneAt,{type:'todo',t}));
    const keys=Object.keys(days).sort().reverse().slice(0,30); if(!keys.length){ list.append(h('div',{class:'empty',html:`<div class="ei">${ic('scroll-text')}</div><b>まだ記録がありません</b>`})); return; }
    keys.forEach(k=>{ const d=days[k]; const dt=new Date(k+'T00:00'); const card=h('div',{class:'logDay'}); card.append(h('div',{class:'logDate',html:`<b>${dt.getMonth()+1}月${dt.getDate()}日（${'日月火水木金土'[dt.getDay()]}）</b><small>${d.chats.length}件のチャット・${d.lib.length}個作成${d.todo.length?'・ToDo '+d.todo.length+'件完了':''}</small>`}));
      d.chats.forEach(({c})=>{ const r=h('div',{class:'logRow',html:`<span class="li">${ic(c.kind==='code'?'code-xml':c.kind==='schedule'?'calendar-clock':'message-square')}</span><div style="flex:1;min-width:0"><b>${esc(c.title||'チャット')}</b><small>${esc((c.log&&c.log.text.split('\n').find(l=>l.trim()&&!l.startsWith('#')))||c.summary||'').slice(0,110)}</small></div>`}); const sb=h('button',{class:'btn sm ghost',html:ic('scroll-text')+(c.log?'まとめ':'まとめる')}); sb.onclick=e=>{ e.stopPropagation(); chatSummary(c); }; r.append(sb); r.onclick=()=>go(c.kind==='code'?'#/code':'#/chat/'+c.id); card.append(r); });
      if(d.lib.length){ const l=h('div',{class:'row',style:'flex-wrap:wrap;gap:6px;padding:6px 4px'}); d.lib.forEach(({x})=>{ const b=h('button',{class:'chip',html:ic((KINDS[x.kind]||[])[1]||'file')+esc(x.name)}); b.onclick=()=>openLibItem(x.id); l.append(b); }); card.append(l); }
      d.runs.forEach(({s,r})=>{ const row=h('div',{class:'logRow',html:`<span class="li">${ic('calendar-clock')}</span><div style="flex:1;min-width:0"><b>${esc(s.title)}</b><small>${esc(r.summary||'')}</small></div>`}); row.onclick=()=>go('#/chat/'+r.chat); card.append(row); });
      d.todo.forEach(({t})=>card.append(h('div',{class:'logRow',html:`<span class="li" style="color:var(--acc2)">${ic('circle-check')}</span><div><b style="text-decoration:line-through;color:var(--ink3)">${esc(t.title)}</b></div>`})));
      list.append(card); }); };
  paint(); const offs=['chats','library','schedules','todos'].map(e=>BUS.on(e,paint)); CUR.cleanup=()=>offs.forEach(f=>f()); };
