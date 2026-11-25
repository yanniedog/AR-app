import hashlib,json,re,subprocess,time,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
out=Path('detail-proof');out.mkdir(exist_ok=True)
pkg='com.eyex.australianrates';root='/data/user/0/'+pkg+'/files/payload/'
def adb(*args,timeout=40):return subprocess.run(['adb',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
def sh(*args):return adb('shell',*args).stdout.decode(errors='replace').strip()
url='https://ar-app-data.jkokavec.workers.dev/v1/release/app-payload-latest/manifest.json'
def head():return json.load(urllib.request.urlopen(url,timeout=40))
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
deadline=time.monotonic()+420
while time.monotonic()<deadline:
 got=proof()
 if current(got):break
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
