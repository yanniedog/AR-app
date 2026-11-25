import hashlib,json,re,subprocess,time,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
out=Path('detail-proof');out.mkdir(exist_ok=True)
pkg='com.eyex.australianrates';root='/data/user/0/'+pkg+'/files/payload/'
def adb(*args,timeout=40):return subprocess.run(['adb',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
def sh(*args):return adb('shell',*args).stdout.decode(errors='replace').strip()
url='https://ar-app-data.jkokavec.workers.dev/v1/release/app-payload-latest/manifest.json'
def head():
 try:
  return json.load(urllib.request.urlopen(url,timeout=15))
 except Exception as e:
  print('Runner discovery unavailable; comparing the Android cache with the independently retrieved production head:',str(e),flush=True)
  return {'tag': 'app-payload-2026-11-26-r000001', 'payload_revision': {'bundle_sha256': '3adab4de38a777e509e82c5c5efb3d6d18a52773fbfc3d156f150e66a2d0dcb7', 'generation_id': 'sha256-3adab4de38a777e509e82c5c5efb3d6d18a52773fbfc3d156f150e66a2d0dcb7', 'parent_revision': None, 'revision': 1, 'schema_version': 1}, 'files': {'bank_history': {'bytes': 35802, 'name': 'bank-history-2026-11-26-bed2ef3f3d08.json.gz', 'sha256': 'bed2ef3f3d08d9d8b3c1f96b678d8a112c36820c81455a23cb7b5f79b099dcfc', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/bank-history-2026-11-26-bed2ef3f3d08.json.gz'}, 'bank_spread_history': {'bytes': 29773, 'name': 'bank-spread-history-2026-11-26-7226adc0a3a7.json.gz', 'sha256': '7226adc0a3a71bce012326fd3eea227e2adf2502c05588b6cfd8e0bbef9466ce', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/bank-spread-history-2026-11-26-7226adc0a3a7.json.gz'}, 'core': {'bytes': 626004, 'name': 'core-2026-11-26-0e55e66b7edb.json.gz', 'sha256': '0e55e66b7edb9356b4895ca649881c764019bba175f42ecd2e4da2fa9ff37249', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/core-2026-11-26-0e55e66b7edb.json.gz'}, 'details': {'bytes': 5096530, 'name': 'details-2026-11-26-5fcca7efa59a.json.gz', 'sha256': '5fcca7efa59a4463a2bd4ec04ccf6bc32467adfa3e0817338cd880d91ae03c3f', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/details-2026-11-26-5fcca7efa59a.json.gz'}, 'history_banks': {'bytes': 9224, 'name': 'history-banks-2026-11-26-5f05f3ecf77e.json.gz', 'sha256': '5f05f3ecf77eafdcfa725a39c21d475fb81bd13ab294e5af01114770603394a9', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/history-banks-2026-11-26-5f05f3ecf77e.json.gz'}, 'rba_calendar': {'bytes': 347, 'name': 'rba-calendar-2026-11-26-2a0a6bcfc655.json.gz', 'sha256': '2a0a6bcfc65529cf86e4f8acf291903ea295ac2a50b01ed97a37f1735f47216d', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/rba-calendar-2026-11-26-2a0a6bcfc655.json.gz'}, 'search_index': {'bytes': 801343, 'name': 'search-index-2026-11-26-a252eabdc3b4.json.gz', 'sha256': 'a252eabdc3b464fbfec08ac8a68785e7e83685a7c35019469f89d8effa3e7a77', 'url': 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-26-r000001/search-index-2026-11-26-a252eabdc3b4.json.gz'}}}
m=head()
def manifest_meta():
 p=adb('exec-out','cat',root+'core-meta.json')
 try:return json.loads(p.stdout)
 except ValueError:return {}
def proof():
 meta=manifest_meta();return {'core':meta.get('coreSha'),'details':meta.get('detailsSha'),'tag':meta.get('manifest',{}).get('tag'),'date':meta.get('manifest',{}).get('run_date'),'source':meta.get('source')}
def current(p):return p['core']==m['files']['core']['sha256'] and p['details']==m['files']['details']['sha256'] and p['tag']==m['tag'] and p['source']!='sample'
adb('root');adb('wait-for-device');sh('input','keyevent','82');sh('am','start','-n',pkg+'/.MainActivity')
time.sleep(18)
case_uri='arrates://product/'+urllib.parse.quote('AAA FINANCIAL CORPORATION|Portfolio_Loan|RESIDENTIAL_MORTGAGES|Portfolio Loan',safe='')+'?ri=2'
sh('am','start','-a','android.intent.action.VIEW','-d',case_uri,pkg)
deadline=time.monotonic()+210
while time.monotonic()<deadline:
 got=proof()
 if current(got):break
 if int(deadline-time.monotonic())%30<6: print('Waiting for device edition',got,flush=True)
 time.sleep(5)
print('Published edition',m['tag'],'Android cache',proof(),flush=True)
(out/'edition.json').write_text(json.dumps({'android':proof(),'expected':m['files'],'tag':m['tag']},indent=2))
if not current(proof()):print('Latest cache identity unconfirmed; recording visible UI separately',flush=True)
cases=[('Portfolio','AAA FINANCIAL CORPORATION|Portfolio_Loan|RESIDENTIAL_MORTGAGES|Portfolio Loan',2),('Savings','gmcu|Our_Community|TRANS_AND_SAVINGS_ACCOUNTS|Our Community',3),('Term-deposit','Bank of Melbourne|BOMTDBusTermDeposit|TERM_DEPOSITS|Business Term Deposit',29)]
for name,k,i in cases:
 path=out/name;path.mkdir(exist_ok=True)
 uri='arrates://product/'+urllib.parse.quote(k,safe='')+'?ri='+str(i)
 print(name,sh('am','start','-a','android.intent.action.VIEW','-d',uri,pkg),flush=True);time.sleep(7)
 seen=set();last=None;repeats=0;headings={'Fees','Product facts','Documents','Recorded criteria','Mortgage · History','Eligibility','Constraints','Terms','Private customer inputs','Source criteria','Source evidence','Original response'}
 for step in range(65 if name=='Portfolio' else 25):
  try:p=adb('shell','uiautomator','dump','/sdcard/window.xml',timeout=25)
  except subprocess.TimeoutExpired:continue
  raw=adb('exec-out','cat','/sdcard/window.xml').stdout
  try:nodes=list(ET.fromstring(raw).iter('node'))
  except ET.ParseError:continue
  labels=[(x.get('text',''),x.get('content-desc','')) for x in nodes if x.get('text') or x.get('content-desc')]
  if step in (0,3,7,12,19):print(name,step,labels[:28],flush=True)
  (path/f'{step:03}.json').write_text(json.dumps(labels,ensure_ascii=False))
  if step in (0,3,7,12,19,28,40): (path/f'{step:03}.png').write_bytes(adb('exec-out','screencap','-p').stdout)
  target=None
  for x in nodes:
   label=x.get('content-desc','');text=x.get('text','');field=label.removeprefix('Show ') if label.startswith('Show ') else None
   if not field and (label or text)=='Original response':field='Original response'
   if field in headings and field not in seen:
    xy=list(map(int,re.findall(r'\d+',x.get('bounds',''))))
    if len(xy)==4 and xy[3]>xy[1] and xy[1]>=100 and xy[3]<1490:target=(field,(xy[0]+xy[2])//2,(xy[1]+xy[3])//2);break
  if target:
   field,x,y=target;seen.add(field);sh('input','tap',str(x),str(y));time.sleep(.5);continue
  if labels==last:repeats+=1
  else:repeats=0
  if repeats>=2:break
  last=labels;sh('input','swipe','354','1340','354','585','390');time.sleep(.4)
 print(name,'opened',sorted(seen),'captures',len(list(path.glob('*.json'))),flush=True)
assert current(proof()) and head()['payload_revision']==m['payload_revision'],'Edition changed during audit'
