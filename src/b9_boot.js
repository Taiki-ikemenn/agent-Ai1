/* ===== 起動 ===== */
(async()=>{ applyTheme(); $('#app').innerHTML=`<div class="login" style="background:#0b1020"><div class="lc"><img src="${LOGO_URL}" alt="" style="animation:float 2.4s ease-in-out infinite"><p style="margin:0">読み込み中…</p></div></div>`;
  try{ await fbInit(); }catch(e){ console.error(e); renderLogin('サーバーにつながりません。ネットワークを確認して、開き直してください。'); return; }
  let booted=false, lastUid=null;
  const onUser=u=>{ if(!u){ lastUid=null; stopSync(); renderLogin(); return; } if(u.uid===lastUid) return; lastUid=u.uid; renderShell(); startSync(); route();
    if(!booted){ booted=true; startScheduler(); spotifyCallback().catch(()=>{}); setTimeout(()=>{ try{ feedAuto(); }catch(e){} },9000); } };
  BUS.on('auth',onUser); onUser(FB.user);
  BUS.on('chats',paintRecent); BUS.on('projects',()=>{ paintRecent(); paintMe(); }); BUS.on('project',()=>{ paintRecent(); paintMe(); }); BUS.on('sync',paintMe); BUS.on('settings',()=>{ applyTheme(); paintMe(); });
  addEventListener('resize',applyTheme);
  if('serviceWorker' in navigator&&location.protocol==='https:'){ navigator.serviceWorker.register('sw.js').catch(()=>{}); navigator.serviceWorker.addEventListener('message',e=>{ if(e.data&&e.data.go) location.hash=e.data.go; }); }
})();
