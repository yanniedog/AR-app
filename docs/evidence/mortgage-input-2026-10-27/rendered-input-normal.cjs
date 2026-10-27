const {chromium}=require('playwright');
const fs=require('fs');const crypto=require('crypto');
const address=process.argv[2],output=process.argv[3],version=process.argv[4];
if(!address||!output||!version)throw Error('Pass address, output JSON and source label');
const reqSource=name=>{const entry=[...globalThis.__r.getModules().entries()].find(([,m])=>m.verboseName===name);if(!entry)throw Error('Missing module '+name);return globalThis.__r(entry[0]);};
async function install(page){
 return page.evaluate(reqText=>{
  const req=(0,eval)('('+reqText+')');globalThis.__benchReq=req;
  const store=req('src/data/store.ts').useStore,session=req('src/data/ratesSession.ts');
  const mortgage=[],savings=[],products={},publicProducts=[],programmesByProduct=new Map(),productByKey=new Map();const checkedAt='2026-10-26T09:00:00.000Z';
  let index=0;
  for(let p=0;p<2813;p++){
   const section=p<1368?'Mortgage':'Savings',bank=p<350||p>=1368&&p<1718;
   const provider=bank?'Benchmark Bank':`Bank ${String(p%102).padStart(3,'0')}`,key=`benchmark-${p}`,productId=`product-${p}`;
   const publicProduct={productId,productKey:key,providerId:provider,providerName:provider,name:`Synthetic ${section} ${String(p).padStart(4,'0')}`,section,status:'current',programmeIds:[],referenceIds:[],aliases:[],reasonCodes:[]};
   products[key]={product_key:key,description:'',eligibility:[],constraints:[],features:[],fees:[]};
   const book=[];const tiers=p<89||p===1368?5:6;
   for(let t=0;t<tiers;t++){
    const rate=section==='Mortgage'?(bank?0.04:0.07)+(p%100)/100000+t/1000000:(bank?0.05:0.03)+(p%100)/100000+t/1000000;
    const row={product_key:key,product_name:publicProduct.name,provider,rate:String(rate),rate_index:index++,account_class:'standard',category:section==='Mortgage'?'RESIDENTIAL_MORTGAGES':'TRANS_AND_SAVINGS_ACCOUNTS',taxonomy_path:section==='Mortgage'?'HOME_LOAN':'SAVINGS',ribbon_deposit_kind:'base',loan_purpose:'OWNER_OCCUPIED',repayment_type:'PRINCIPAL_AND_INTEREST',ribbon_repayment_type:'PRINCIPAL_AND_INTEREST',rate_type:'VARIABLE',lvr_tier:'lvr_<=80%',comparison_rate:String(rate+0.001)};
    (section==='Mortgage'?mortgage:savings).push(row);
    const id=`programme-${p}-${t}`,offerId=`offer-${p}-${t}`;publicProduct.programmeIds.push(id);
    book.push({schemaVersion:1,programmeId:id,productId,offerId,section,conditions:section==='Mortgage'?[{conditionId:'purpose',field:'purpose',operator:'eq',value:'OWNER_OCCUPIED'},{conditionId:'repayment',field:'repayment',operator:'eq',value:'PRINCIPAL_AND_INTEREST'},{conditionId:'lvr',field:'lvr',operator:'bounds',maximum:'0.8'}]:[],
     components:[{componentId:'payable',role:'payable',value:row.rate,unit:'fraction_per_annum',scopeId:offerId,conditions:[],evidenceIds:['synthetic-source'],source:{rawType:section==='Mortgage'?'VARIABLE':'BASE',rawValue:row.rate,pointer:`/rates/${row.rate_index}`}},{componentId:'comparison',role:'comparison',value:row.comparison_rate,unit:'fraction_per_annum',scopeId:offerId,conditions:[],evidenceIds:['synthetic-source'],source:{rawType:'COMPARISON',rawValue:row.comparison_rate,pointer:`/rates/${row.rate_index}`}}],
     formula:{op:'component',componentId:'payable'},evidenceIds:['synthetic-source'],reasonCodes:[],freshness:{state:'current',checkedAt,lastSuccessAt:checkedAt,reasonCodes:[]},sourceBindings:[{rateIndex:row.rate_index,pointer:`/rates/${row.rate_index}`}],metadata:{rateStructure:section==='Mortgage'?'variable':'base'}});
   }
   publicProducts.push(publicProduct);productByKey.set(key,publicProduct);programmesByProduct.set(productId,book);
  }
  const view={generationId:'deterministic-rendered-fixture',status:'ready',allLoaded:true,products:publicProducts,references:[],coverage:[],evidence:[],getProduct:key=>productByKey.get(key),getProgrammes:id=>programmesByProduct.get(id)||[],loadAll:async()=>{},loadProduct:async()=>{}};
  globalThis.__benchCatalogue=view;
  const catalogueModule=req('src/data/publicRateCatalogue.ts'),original=catalogueModule.usePublicRateCatalogue;
  const testHook=(...args)=>{original(...args);return view;};
  catalogueModule.usePublicRateCatalogue=testHook;
  if(catalogueModule.usePublicRateCatalogue!==testHook)throw Error('Catalogue test provider override was not installed');
  const ribbon={counts:{rates:0,products:0,providers:0},range:{min:null,max:null,mean:null,median:null},providers:[]};
  const core={schema_version:1,run_date:checkedAt.slice(0,10),brands:{},rba:[],sections:{Mortgage:{rates:mortgage,ribbon},Savings:{rates:savings,ribbon},TD:{rates:[],ribbon}}};
  const prefs={...store.getState().prefs,includeNonStandard:true,interests:['Savings','Mortgage','TD'],enableDeepSearch:false,ratesPageSize:50,showBankInsights:false,mortgageRateMetric:'headline'};
  const noop=async()=>{};
  store.setState({core,details:{schema_version:1,run_date:core.run_date,products},manifest:null,coreIntegrity:null,hydrated:true,status:'ready',source:'cache',error:null,activeSection:'Savings',prefs,detailsLoading:false,ensureDetails:noop,ensureHistoryBanks:noop,ensureProductHistory:noop,ensureBankInsights:noop});
  req('src/data/eligibilityGate.ts').installMandatoryEligibility({active:false,loading:false,rows:new WeakSet(),productKeys:new Set()});
  req('src/data/suitabilityGate.ts').setSuitabilityAllowed(null);
  session.initializeRatesSession(prefs,'Savings');session.changeRatesSection('Savings');
  globalThis.__fixtureInstalled=performance.now();
  globalThis.__visibleRows=mode=>{
   let scope=document;
   if(mode==='bank'){
    const header=[...document.querySelectorAll('*')].find(el=>!el.children.length&&el.textContent==='Current products'&&el.getBoundingClientRect().height>0);
    if(!header)return[];
    let parent=header.parentElement;
    while(parent&&!parent.querySelector('[role="button"][aria-label*="Synthetic"]'))parent=parent.parentElement;
    if(!parent)return[];scope=parent;
   }
   return [...scope.querySelectorAll('[role="button"]')].filter(el=>{
    const text=el.getAttribute('aria-label')||'',b=el.getBoundingClientRect();
    if(!/^Synthetic (Mortgage|Savings)/.test(text)||!text.includes('Benchmark Bank')||b.width<=0||b.height<=0||b.top>=innerHeight||b.bottom<=0||el.getAttribute('aria-disabled')==='true')return false;
    for(let a=el;a;a=a.parentElement){const s=getComputedStyle(a);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}
    const x=Math.max(1,Math.min(innerWidth-1,b.left+Math.min(b.width/2,100))),y=Math.max(1,Math.min(innerHeight-1,(Math.max(0,b.top)+Math.min(innerHeight,b.bottom))/2));
    const hit=document.elementFromPoint(x,y);return !!hit&&(el===hit||el.contains(hit));
   }).map(el=>({label:el.getAttribute('aria-label'),rect:JSON.parse(JSON.stringify(el.getBoundingClientRect()))}));
  };
  return{products:publicProducts.length,providers:103,rates:mortgage.length+savings.length,mortgageRates:mortgage.length,savingsRates:savings.length,selectedBankProducts:700,programmes:[...programmesByProduct.values()].reduce((n,book)=>n+book.length,0),checkedAt};
 },reqSource.toString());
}
const rowsReady=(page,mode='rates',timeout=45000)=>page.waitForFunction(mode=>globalThis.__visibleRows?.(mode).length>0,mode,{timeout});
async function measureBank(page,index){
 const bank=page.getByRole('button',{name:/View Benchmark Bank/}).first();
 await bank.evaluate(el=>el.addEventListener('click',()=>{globalThis.__click=performance.now();},{once:true}));await bank.click();
 await page.waitForFunction(()=>location.pathname.includes('/bank/'));await rowsReady(page,'bank');
 return page.evaluate(async index=>{const dom=performance.now()-globalThis.__click,visible=globalThis.__visibleRows('bank');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{iteration:index,kind:index===0?'cold':'warm',at:new Date().toISOString(),clickToVisibleUsableDomMs:dom,clickToTwoFramesMs:performance.now()-globalThis.__click,visibleRows:visible.map(r=>r.label),path:location.pathname};},index);
}
async function extended(page){
 const results={};
 // Real scroll, then Back and Forward with retained in-memory source.
 results.scroll=await page.evaluate(async()=>{const first=globalThis.__visibleRows('bank');let scroll=[...document.querySelectorAll('*')].find(el=>el.scrollHeight>el.clientHeight+200&&['auto','scroll'].includes(getComputedStyle(el).overflowY)&&el.querySelector('[aria-label*="Synthetic"]'));
  if(!scroll)return{available:false};const start=performance.now();scroll.scrollTop+=600;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{available:true,elapsedMs:performance.now()-start,before:first.map(r=>r.label),after:globalThis.__visibleRows('bank').map(r=>r.label)};});
 await page.goBack();await page.waitForFunction(()=>!location.pathname.includes('/bank/'));await rowsReady(page);
 await page.goForward();await page.waitForFunction(()=>location.pathname.includes('/bank/'));await rowsReady(page,'bank');results.backForward=true;
 await page.goBack();await page.waitForFunction(()=>!location.pathname.includes('/bank/'));await rowsReady(page);
 // Interrupt bank navigation with immediate browser Back, then repeat selection.
 const bank=page.getByRole('button',{name:/View Benchmark Bank/}).first();await bank.click();await page.goBack();await page.waitForFunction(()=>!location.pathname.includes('/bank/'));await rowsReady(page);results.interruptedNavigationRecovered=true;
 await page.evaluate(()=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.beginCapture('browser-scope'));
 results.sheetLifecycle=[];
 for(const [open,close,label]of [['search.filters.open','search.filters.cancel','Close Temporary filters'],['search.sort.open','search.sort.cancel','Close Sort']]){
  const hasProof=await page.evaluate(()=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results')?.probes.some(p=>p.id==='search.sheet'));
  if(!hasProof){results.sheetLifecycle.push({open,legacyMissingProof:true});continue;}
  await page.evaluate(async action=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.invokeAction('rates.results',action),open);
  await page.waitForFunction(()=>{const s=globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results');return s?.probes.find(p=>p.id==='search.sheet')?.status==='ready'&&s?.probes.find(p=>p.id==='search.list')?.coveredBySheet===true;},{},{timeout:10000});
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(()=>{const s=globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results');return s?.probes.find(p=>p.id==='search.sheet')?.status==='ready'&&s?.probes.find(p=>p.id==='search.list')?.coveredBySheet===false&&s?.probes.find(p=>p.id==='search.list')?.status==='ready';},{},{timeout:10000});
  await rowsReady(page);results.sheetLifecycle.push({open,presented:true,dismissed:true,underlyingProductsVisible:true});
 }
 await page.getByText('Home loans',{exact:true}).first().click();
 await page.waitForFunction(()=>!!document.querySelector('input[aria-label="LVR"]'));
 const applyScope=async lvr=>{
  await page.evaluate(async lvr=>{
   const r=globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry;
   globalThis.__scopePreviousRender=r.snapshot().surfaces.find(s=>s.id==='rates.results')?.renderRevision;
   globalThis.__scopeStart=performance.now();
   const result=await r.invokeAction('rates.results','search.mortgage.scope.apply.0',{loanAmount:'500000',lvr,loanPurposes:['OWNER_OCCUPIED'],repaymentTypes:['PRINCIPAL_AND_INTEREST']});
   if(result?.unavailableReason)throw Error(result.unavailableReason);
  },lvr);
 };
 const scopeReady=()=>page.waitForFunction(()=>{
  const req=globalThis.__benchReq,s=req('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results');
  return s&&s.renderRevision!==globalThis.__scopePreviousRender&&s.probes.find(p=>p.id==='search.data')?.status==='ready'&&s.probes.find(p=>p.id==='search.list')?.status==='ready'&&globalThis.__visibleRows('rates').some(row=>row.label.startsWith('Synthetic Mortgage'));
 },{},{timeout:10000});
 await applyScope('75');
 try{await scopeReady();results.mortgageScope={converged:true,elapsedMs:await page.evaluate(()=>performance.now()-globalThis.__scopeStart)};}
 catch(e){
  await page.screenshot({path:output+'.scope.png'});
  results.mortgageScope={converged:false,error:e.message,snapshot:await page.evaluate(()=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results')),
   firstRows:await page.evaluate(()=>[...document.querySelectorAll('[role=button]')].filter(el=>(el.getAttribute('aria-label')||'').startsWith('Synthetic Mortgage')).slice(0,3).map(el=>({label:el.getAttribute('aria-label'),rect:JSON.parse(JSON.stringify(el.getBoundingClientRect()))})))};
 }
 results.repeatedScopes=[];
 for(const lvr of results.mortgageScope.converged?['80','70','75']:[]){await applyScope(lvr);await scopeReady();results.repeatedScopes.push({lvr,elapsedMs:await page.evaluate(()=>performance.now()-globalThis.__scopeStart)});}
 if(!results.mortgageScope.converged){
  await page.evaluate(()=>{const row=[...document.querySelectorAll('[role=button]')].find(el=>(el.getAttribute('aria-label')||'').startsWith('Synthetic Mortgage'));row?.scrollIntoView({block:'center',inline:'nearest'});});
  await rowsReady(page);results.scopeRecoveryScrolledToProducts=true;
 }
 await page.evaluate(()=>{const req=globalThis.__benchReq;req('src/data/store.ts').useStore.setState(s=>({prefs:{...s.prefs,includeNonStandard:false}}));req('src/data/suitabilityGate.ts').setSuitabilityAllowed(new Set(),{rebuildClosed:true});});
 await page.waitForTimeout(100);
 results.forcedReadinessTimeout=await page.evaluate(async()=>{const r=globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry,start=performance.now();try{await r.waitForReady({surfaceIds:['rates.results'],requiredKinds:['data','list'],timeoutMs:10000,quietWindowMs:0});return{timedOut:false};}catch(e){return{timedOut:true,name:e.name,elapsedMs:performance.now()-start,blockers:e.snapshot?.blockers?.map(b=>b.code)};}});
 await page.evaluate(()=>{const req=globalThis.__benchReq;req('src/data/suitabilityGate.ts').setSuitabilityAllowed(null);req('src/data/store.ts').useStore.setState(s=>({prefs:{...s.prefs,includeNonStandard:true}}));});await rowsReady(page);
 results.compareAfterTimeout=await page.evaluate(async()=>{
  const req=globalThis.__benchReq,r=req('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry,s=req('src/data/ratesSession.ts');
  await r.invokeAction('rates.results','search.compare.mode');
  return{selectMode:s.useRatesSession.getState().sections[s.useRatesSession.getState().section].selectMode,visibleRows:globalThis.__visibleRows('rates').length};
 });
 // Actual row presses use the same production selection handlers as the UI.
 for(let i=0;i<2;i++){const buttons=page.getByRole('button',{name:/^Synthetic (Mortgage|Savings)/});const count=await buttons.count();if(!count)break;await buttons.nth(i).click({position:{x:20,y:20}});}
 results.compareAfterTimeout.selected=await page.evaluate(()=>(()=>{const state=globalThis.__benchReq('src/data/ratesSession.ts').useRatesSession.getState();return state.sections[state.section].selected.length;})());
 results.compareAfterTimeout.names=await page.evaluate(()=>{const req=globalThis.__benchReq,s=req('src/data/ratesSession.ts').useRatesSession.getState();return s.sections[s.section].selected;});
 await page.getByRole('button',{name:'Compare 2',exact:true}).click();
 await page.waitForFunction(()=>location.pathname==='/compare'&&globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.some(s=>s.id==='compare.table'&&s.probes.find(p=>p.id==='compare.data')?.status==='ready'&&s.probes.find(p=>p.id==='compare.columns')?.actualCount===2),{},{timeout:10000});
 results.compareAfterTimeout.destination=await page.evaluate(()=>({path:location.pathname,visibleTitles:[...document.querySelectorAll('[dir=auto]')].filter(el=>el.textContent.startsWith('Synthetic Mortgage')&&el.children.length===0).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.y>=0&&r.y+r.height<=innerHeight&&r.x<innerWidth&&r.right>0;}).map(el=>el.textContent)}));
 await page.goBack();await page.waitForFunction(()=>location.pathname!=='/compare');await rowsReady(page);
 await page.setViewportSize({width:320,height:640});
 // Browser-only typography stress, not an Android system-font-scale assertion.
 results.largeText=await page.evaluate(async()=>{
  const text=[...document.querySelectorAll('[dir=auto],input')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);
  for(const [el,size]of text)if(size>0){el.style.fontSize=(size*1.5)+'px';el.style.lineHeight='normal';}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const inputs=[...document.querySelectorAll('input[aria-label="Loan amount"],input[aria-label="LVR"]')].map(el=>({label:el.getAttribute('aria-label'),rect:JSON.parse(JSON.stringify(el.getBoundingClientRect()))}));
  const row=[...document.querySelectorAll('[role=button]')].find(el=>(el.getAttribute('aria-label')||'').startsWith('Synthetic Mortgage'));row?.scrollIntoView({block:'center'});
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return{kind:'CSS 150 percent text stress',viewport:{width:innerWidth,height:innerHeight},inputs,visibleProductCount:globalThis.__visibleRows('rates').length};
 });
 results.terminal=await page.evaluate(()=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results'));
 return results;
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:412,height:915}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());return['localhost','127.0.0.1'].includes(u.hostname)||['data:','blob:'].includes(u.protocol)?r.continue():r.abort();});
 const report={scenarioSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),source:version,startedAt:new Date().toISOString(),kind:'Expo development web; audit capture OFF; synthetic exact membership+price DOM proof, no Android claim'};
 try{
 await page.goto(address,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>globalThis.__r?.getModules?.().size>1000,{},{timeout:120000});
 await page.evaluate(reqText=>{const req=(0,eval)('('+reqText+')');globalThis.__indexTimings=[];let m;try{m=req('src/data/mortgageResultsIndex.ts')}catch{return;}const original=m.prepareMortgageResultsIndex;m.prepareMortgageResultsIndex=async(...args)=>{const t=performance.now(),index=await original(...args);globalThis.__indexTimings.push({stage:'prepare',ms:performance.now()-t,endedAt:performance.now(),count:index?.count});if(index){const select=index.select;index.select=(...args)=>{const t=performance.now(),result=select(...args);globalThis.__indexTimings.push({stage:'select',ms:performance.now()-t,count:result?.priced.length});if(result){const filtered=result.filtered;result.filtered=(...args)=>{const t=performance.now(),rows=filtered(...args);globalThis.__indexTimings.push({stage:'filter',ms:performance.now()-t,count:rows?.length});return rows;};}return result;};}return index;};},String(reqSource));
 report.fixture=await install(page);await rowsReady(page);
 await page.evaluate(()=>{globalThis.__stages=[];for(const [file,names] of [['src/data/publicRateIntegration.ts',['publicRecommendationRowsCooperatively','resolvedPublicRankingRowsCooperatively']],['src/data/mortgageComparison.ts',['mortgageComparisonRowsCooperatively']],['src/data/selectors.ts',['prepareSearchRows']]]){const m=globalThis.__benchReq(file);for(const name of names){const original=m[name];m[name]=async(...args)=>{const t=performance.now();const result=await original(...args);globalThis.__stages.push({name,ms:performance.now()-t,input:args[0]?.length,output:result?.rows?.length??result?.length,cancelled:result==null});return result;};}}});
 await page.evaluate(()=>{globalThis.__benchReq('src/data/ratesSession.ts').changeRatesSection('Mortgage');globalThis.__benchReq('src/data/store.ts').useStore.getState().setActiveSection('Mortgage');});
 await page.getByRole('textbox',{name:'Loan amount',exact:true}).waitFor();
 await page.evaluate(()=>{globalThis.__inputPaint=[];for(const input of document.querySelectorAll('input[aria-label="Loan amount"],input[aria-label="LVR"]'))input.addEventListener('input',()=>{const start=performance.now(),value=input.value;requestAnimationFrame(()=>{const sample={label:input.getAttribute('aria-label'),value,echo:input.value,eventToAnimationFrameMs:performance.now()-start,visibleRows:globalThis.__visibleRows('rates').length};globalThis.__inputPaint.push(sample);requestAnimationFrame(()=>sample.eventToTwoFramesMs=performance.now()-start);});},true);});
 await page.getByRole('textbox',{name:'Loan amount',exact:true}).fill('650000');await page.getByRole('textbox',{name:'LVR',exact:true}).fill('72');await page.waitForTimeout(250);
 report.controls=await page.evaluate(()=>[...document.querySelectorAll('[role=button]')].map(e=>({label:e.getAttribute('aria-label'),text:e.innerText})).filter(e=>/occupied|interest|principal/i.test((e.label||'')+' '+e.text)));
 fs.writeFileSync(output,JSON.stringify(report,null,2));
 const purpose=page.getByRole('button',{name:'Owner occupied',exact:true});await purpose.click();
 const repayment=page.getByRole('button',{name:'Principal & interest',exact:true});
 const armCurrent = async () => repayment.evaluate(el=>el.addEventListener('click',()=>{
  globalThis.__lastFilter=performance.now();globalThis.__emptySamples=0;globalThis.__firstCurrent=null;
  const monitor=()=>{
   const req=globalThis.__benchReq,fields=req('src/data/mortgageComparison.ts').useMortgageComparison.getState(),filters=req('src/data/ratesSession.ts').useRatesSession.getState().sections.Mortgage.filters;
   const surface=req('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results');
   const rows=globalThis.__visibleRows('rates');if(!rows.length)globalThis.__emptySamples++;
   const current=fields.loanAmount==='650000'&&fields.lvr==='72'&&filters.loanPurposes.includes('OWNER_OCCUPIED')&&filters.repaymentTypes.includes('PRINCIPAL_AND_INTEREST')&&/8,?119 rates/.test(document.body.innerText)&&!document.body.innerText.includes('Updating')&&!document.body.innerText.includes('Previous results')&&rows.some(row=>row.label.startsWith('Synthetic Mortgage'));
   if(current&&!globalThis.__firstCurrent){globalThis.__firstCurrent={eventToCurrentMatchingFrameMs:performance.now()-globalThis.__lastFilter,rows,surface};requestAnimationFrame(()=>globalThis.__firstCurrent.eventToTwoFramesMs=performance.now()-globalThis.__lastFilter);}
   if(performance.now()-globalThis.__lastFilter<5000&&!globalThis.__firstCurrent)requestAnimationFrame(monitor);
  };requestAnimationFrame(monitor);
 },{once:true}));
 await armCurrent();await repayment.click();
 await page.waitForFunction(()=>globalThis.__firstCurrent!=null,{},{timeout:15000});
 report.lastFilterToVisible=await page.evaluate(()=>({...globalThis.__firstCurrent,emptyFrames:globalThis.__emptySamples}));

 report.ready=await page.evaluate(()=>({elapsedMs:performance.now()-globalThis.__lastFilter,surface:globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results')}));
 report.warm=[];
 for(let n=0;n<3;n++){
  await repayment.click();await page.waitForFunction(()=>!globalThis.__benchReq('src/data/ratesSession.ts').useRatesSession.getState().sections.Mortgage.filters.repaymentTypes.length);
  await armCurrent();await repayment.click();
  await page.waitForFunction(()=>globalThis.__firstCurrent!=null,{},{timeout:15000});
  report.warm.push(await page.evaluate(()=>globalThis.__firstCurrent));
 }
 report.typing=[];
 for(const value of ['6','65','650','6500','65000','650000']){
  const start=performance.now();await page.getByRole('textbox',{name:'Loan amount',exact:true}).fill(value);
  report.typing.push(await page.evaluate(async value=>{const input=document.querySelector('input[aria-label="Loan amount"]');const before=performance.now();await new Promise(r=>requestAnimationFrame(r));return{value,actual:input.value,frameMs:performance.now()-before,visibleCount:globalThis.__visibleRows('rates').length};},value));await page.waitForTimeout(240);
 }
 await page.waitForTimeout(3000);report.indexTimings=await page.evaluate(()=>globalThis.__indexTimings);report.inputPaint=await page.evaluate(()=>globalThis.__inputPaint);report.stages=await page.evaluate(()=>globalThis.__stages);
 report.boundaries=[];
 for(const value of ['81','72']){
  await page.getByRole('textbox',{name:'LVR',exact:true}).evaluate(el=>el.addEventListener('input',()=>{globalThis.__boundaryStarted=performance.now();globalThis.__boundaryDone=null;const check=()=>{const fields=globalThis.__benchReq('src/data/mortgageComparison.ts').useMortgageComparison.getState(),rows=globalThis.__visibleRows('rates'),expected=el.value==='81'?0:8119;const count=new RegExp(expected===0?'(?:^|\\n)0 rates':'8,?119 rates').test(document.body.innerText);if(fields.lvr===el.value&&count&&!document.body.innerText.includes('Updating')&&(expected===0?!rows.length:rows.some(r=>r.label.startsWith('Synthetic Mortgage 0000, Benchmark Bank, Public payable rate 4.0000%')))){globalThis.__boundaryDone={input:el.value,eventToCorrectVisibleOutcomeMs:performance.now()-globalThis.__boundaryStarted,expected,rows};return;}if(performance.now()-globalThis.__boundaryStarted<10000)requestAnimationFrame(check);};requestAnimationFrame(check);},{once:true}));
  await page.getByRole('textbox',{name:'LVR',exact:true}).fill(value);await page.waitForFunction(()=>globalThis.__boundaryDone!=null,{},{timeout:12000});report.boundaries.push(await page.evaluate(()=>globalThis.__boundaryDone));
 }
 report.rapidBurst=[];
 for(const [label,value] of [['Loan amount','6'],['LVR','81'],['Loan amount','650000'],['LVR','72']])await page.getByRole('textbox',{name:label,exact:true}).fill(value);
 await page.waitForFunction(()=>{const f=globalThis.__benchReq('src/data/mortgageComparison.ts').useMortgageComparison.getState();return f.loanAmount==='650000'&&f.lvr==='72'&&/8,?119 rates/.test(document.body.innerText)&&!document.body.innerText.includes('Updating')&&globalThis.__visibleRows('rates').some(r=>r.label.startsWith('Synthetic Mortgage 0000, Benchmark Bank, Public payable rate 4.0000%'));},{},{timeout:15000});report.rapidBurst={converged:true};
 const firstRow=page.getByRole('button',{name:/^Synthetic Mortgage 0000, Benchmark Bank/}).first();await firstRow.click();await page.waitForFunction(()=>location.pathname!=='/browse');await page.goBack();await page.waitForFunction(()=>location.pathname==='/browse');await rowsReady(page);report.interruptedProductNavigationRecovered=true;
 await page.getByRole('button',{name:'Clear comparison inputs',exact:true}).click();await page.waitForFunction(()=>{const f=globalThis.__benchReq('src/data/mortgageComparison.ts').useMortgageComparison.getState();return !f.loanAmount&&!f.lvr&&!globalThis.__visibleRows('rates').length;});report.clearRetainsNoOldRows=true;
 report.final=await page.evaluate(()=>globalThis.__benchReq('src/lib/performanceAuditReadiness.ts').performanceAuditReadinessRegistry.snapshot().surfaces.find(s=>s.id==='rates.results'));
 }catch(e){report.error=String(e.stack);}finally{report.errors=errors;report.finishedAt=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2));await browser.close();}
})();