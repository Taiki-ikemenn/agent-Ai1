import re,os,json
D='/home/claude/lucide/package/icons'
FILES=['a1_core.js','a2_data.js','a3_ai.js','a4_media.js','a5_conn.js','a6_tools.js','b1_shell.js','b2_chat.js','b3_projects.js','b4_code.js','b5_library.js','b6_schedule.js','b7_feed.js','b8_custom.js','b9_boot.js']
js='\n'.join(open(f).read() for f in FILES)
names=set(re.findall(r"""['"]([a-z][a-z0-9-]*)['"]""",js))|{'circle'}
icons={}
for n in sorted(names):
    p=os.path.join(D,n+'.svg')
    if os.path.exists(p):
        s=open(p).read(); s=s[s.index('>',s.index('<svg'))+1:s.rindex('</svg>')]
        icons[n]=re.sub(r'\s+',' ',s).strip()
missing=sorted(set(re.findall(r"ic\('([a-z0-9-]+)'",js))-set(icons))
if missing: print('MISSING ICONS',missing)
sh=open('shell.html').read()
out=sh.replace('/*CSS*/',open('style.css').read()).replace('/*ICONS*/','const ICONS='+json.dumps(icons,ensure_ascii=False)+';').replace('/*APP*/',js)
open('index.html','w').write(out); print('icons',len(icons),'bytes',len(out.encode()))
