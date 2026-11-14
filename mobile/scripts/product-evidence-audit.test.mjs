import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { audit } = require('./audit-public-payload.cjs');
const { candidate, hash } = require('./product-evidence-audit-fixture.cjs');
const { auditProductEvidence } = require('./audit-product-evidence.cjs');
const { validateEvidenceCandidate, validateEvidencePublication } = require('../src/data/productEvidencePublication.ts');
const { automaticDataUrl } = require('../src/lib/automaticDataAccess.ts');

for (const revision of [false,true]) test(`complete private evidence audit, revision=${revision}, never invents public selection`, async t => {
  const p=candidate(t,{revision}), report=await audit(p.options), receipt=report.optional_product_evidence;
  assert.equal(receipt.status,'PASS'); assert.equal(receipt.namespace_validation_complete,true);
  assert.equal(receipt.scope,'private_candidate'); assert.equal(report.publication_verified,false);
  for (const field of ['selected_head_verified','public_transport_verified','rendered_coverage_verified','population_completeness_verified','original_wire_bytes_verified']) assert.equal(receipt[field],false);
  assert.equal(report.optional_product_evidence_summary.product_evidence_v1.facts,66);
  assert.equal(report.optional_product_evidence_summary.product_response_evidence_v1.bodies,6);
  for(const lane of Object.values(receipt.lanes))assert.deepEqual(Object.keys(lane).sort(),['reason','state','verified_asset_count']);
  assert.equal(receipt.lanes.product_evidence_v1.verified_asset_count+receipt.lanes.product_response_evidence_v1.verified_asset_count,Object.keys(p.assets).length);
  assert.deepEqual(new Set(Object.values(report.assets).filter(item=>item.status==='PASS').map(item=>item.sha256)),
    new Set([...Object.values(p.manifest.files).map(item=>item.sha256),...Object.values(p.assets).map(hash)]));
});

for (const kind of ['capability','index','shard']) test(`missing ${kind} cannot disappear from successful audit`, async t => {
  const p=candidate(t); fs.unlinkSync(path.join(p.directory,Object.keys(p.assets).find(name=>name.startsWith(`product-response-${kind}-`))));
  const report=await audit(p.options);
  assert.equal(report.status,'FAIL'); assert.equal(report.optional_product_evidence.status,'FAIL');
  assert.equal(report.optional_product_evidence.namespace_validation_complete,false);
});

test('original noncurrent index body bytes are hashed, not just declared compressed assets', async t => {
  const p=candidate(t,{mutate(lane,kind,value) {
    if(lane==='product_response_evidence_v1'&&kind==='shard') value.pages[0].text='X'+value.pages[0].text.slice(1);
  }});
  const report=await audit(p.options);
  assert.equal(report.optional_product_evidence.status,'FAIL'); assert.match(report.optional_product_evidence.error,/body hash mismatch/);
});

test('duplicate fact IDs fail despite valid compressed hashes and declared counts', async t => {
  const p=candidate(t,{mutate(lane,kind,value) {
    if(lane==='product_evidence_v1'&&kind==='shard') value.pages[0].facts[1].fact_id=value.pages[0].facts[0].fact_id;
  }});
  const report=await audit(p.options); assert.equal(report.status,'FAIL');
  assert.match(report.optional_product_evidence.error,/Duplicate product fact/);
});

test('rehashed mixed source and malformed available metadata fail', async t => {
  const p=candidate(t,{mutate(lane,kind,value) {
    if(lane==='product_response_evidence_v1'&&kind==='capability') value.binding.facts.snapshot_sha256='0'.repeat(64);
  }});
  const report=await audit(p.options); assert.equal(report.optional_product_evidence.status,'FAIL');
  delete p.manifest.product_response_evidence_v1;p.seal();
  assert.equal((await audit(p.options)).optional_product_evidence.status,'FAIL');
});

test('known pending and disabled metadata requires no evidence IO', async t => {
  const p=candidate(t);
  for(const [lane,state,reason] of [['product_evidence_v1','pending','not_prepared'],['product_response_evidence_v1','disabled','disabled_by_configuration']]) {
    delete p.manifest[lane];p.manifest.optional_product_evidence_status.lanes[lane]={state,reason};
  }
  for(const name of Object.keys(p.assets))fs.unlinkSync(path.join(p.directory,name));p.seal();
  const report=await audit(p.options);assert.equal(report.optional_product_evidence.status,'PASS');
  assert.equal(report.optional_product_evidence.lanes.product_evidence_v1.verified_asset_count,0);
  assert.equal(report.checks.find(row=>row.code==='optional-product-evidence').status,'warn');
});

for(const fault of ['namespace','status','capability'])test(`unknown ${fault} is unsupported, not partial PASS`,async t=>{
  const p=candidate(t,{mutate(lane,kind,value){if(fault==='capability'&&lane==='product_evidence_v1'&&kind==='capability')value.schema='future';}});
  if(fault==='namespace')p.manifest.product_evidence_future={};
  if(fault==='status')p.manifest.optional_product_evidence_status.schema='future';p.seal();
  const report=await audit(p.options);assert.equal(report.optional_product_evidence.status,'UNSUPPORTED');assert.equal(report.status,'FAIL');
});

test('private candidate validator cannot bypass the selected consumer wrapper',t=>{
  const p=candidate(t,{revision:false}); assert.equal(validateEvidenceCandidate(p.manifest).availability.product_evidence_v1.state,'available');
  assert.throws(()=>validateEvidencePublication(p.manifest,p.head));
  const selected=candidate(t);assert.throws(()=>validateEvidencePublication(selected.manifest,{...selected.head,bundle_sha256:'0'.repeat(64)}));
});

test('public evidence audit requires real selected binding and authenticated transport admission',async t=>{
  const p=candidate(t), financialAssets={core:{status:'PASS'},details:{status:'PASS'}};
  for(const bad of [{head:null,publicTransportVerified:true},{head:p.head,publicTransportVerified:false},{head:{...p.head,manifest_sha256:'0'.repeat(64)},publicTransportVerified:true}]){
    const result=await auditProductEvidence({manifest:p.manifest,manifestSha:p.head.manifest_sha256,directory:null,financialAssets,
      read:()=>assert.fail('unadmitted read'),...bad});assert.equal(result.receipt.status,'FAIL');
  }
  const verified=await auditProductEvidence({manifest:p.manifest,manifestSha:p.head.manifest_sha256,head:p.head,directory:null,
    financialAssets,publicTransportVerified:true,read:async item=>p.assets[item.name]});
  assert.equal(verified.receipt.status,'PASS'); assert.equal(verified.receipt.scope,'public_selected');
  assert.equal(verified.receipt.selected_head_verified,true);assert.equal(verified.receipt.public_transport_verified,true);
});

test('financial-only audit has no optional receipt or check',async t=>{
  const p=candidate(t);delete p.manifest.product_evidence_v1;delete p.manifest.product_response_evidence_v1;
  delete p.manifest.optional_product_evidence_status;p.seal();
  const report=await audit(p.options);assert.equal(Object.hasOwn(report,'optional_product_evidence'),false);
  assert.equal(report.checks.some(row=>row.code==='optional-product-evidence'),false);
});

test('legacy reference-only candidate remains explicitly unreported',async t=>{
  const p=candidate(t);delete p.manifest.optional_product_evidence_status;p.seal();
  const report=await audit(p.options);assert.equal(report.optional_product_evidence.status,'PASS');
  assert.equal(report.optional_product_evidence.lanes.product_evidence_v1.state,'unreported');
  assert.equal(report.optional_product_evidence.lanes.product_evidence_v1.reason,null);
  assert.equal(report.checks.find(row=>row.code==='optional-product-evidence').status,'warn');
});

for(const changed of [false,true])test(`public full audit binds managed immutable reads and final selection, changed=${changed}`,async t=>{
  const p=candidate(t), index={schema_version:1,revision_protocol:1,dates:[p.manifest.run_date],count:1,
    min_date:p.manifest.run_date,latest_date:p.manifest.run_date,revision_heads:{[p.manifest.run_date]:p.head}};
  const previous=globalThis.fetch, requests=[];let indexes=0;
  t.after(()=>{globalThis.fetch=previous;});
  globalThis.fetch=async url=>{
    requests.push(url);const parsed=new URL(url),name=parsed.pathname.split('/').at(-1);
    assert.equal(url,automaticDataUrl(`https://github.com/${p.manifest.repo}/releases/download/${parsed.pathname.split('/').at(-2)}/${name}${parsed.search}`));
    let bytes;
    if(name==='dates-index.json')bytes=Buffer.from(JSON.stringify(changed&&++indexes>1?{...index,changed:true}:index));
    else bytes=fs.readFileSync(path.join(p.directory,name));
    const response=new Response(bytes);return {url,status:200,ok:true,headers:response.headers,body:response.body};
  };
  const report=await audit({...p.options,directory:null});
  assert.equal(report.optional_product_evidence.status,changed?'FAIL':'PASS');
  assert.equal(report.optional_product_evidence.selected_head_verified,!changed);
  assert.equal(requests.filter(url=>url.includes('/dates-index.json')).length,2);
  assert.equal(requests.filter(url=>/product-(evidence|response)-/.test(url)).length,Object.keys(p.assets).length);
  if(changed)assert.equal(report.publication_verified,false);
});

for(const fault of ['inflated-index','compressed-shard','aggregate','nonfinite-count'])test(`declared ${fault} budget rejects before transitive reads`,async t=>{
  const p=candidate(t,{mutate(lane,kind,value){
    if(lane!=='product_evidence_v1'||kind!=='capability')return;
    if(fault==='inflated-index')value.index.decoded_bytes=4*1024**2+1;
    if(fault==='compressed-shard')value.shards[0].bytes=1024**2+1;
    if(fault==='aggregate')value.shards=Array.from({length:129},(_,i)=>({name:`product-evidence-shard-${String(i).padStart(64,'0')}.json.gz`,
      sha256:String(i).padStart(64,'0'),bytes:1024**2,decoded_bytes:4*1024**2}));
    if(fault==='nonfinite-count')value.facts=3000001;
  }});
  const report=await audit(p.options);assert.equal(report.optional_product_evidence.status,'FAIL');
  assert.equal(Object.keys(report.assets).some(key=>key.startsWith('product_evidence_v1_asset_')),false);
});
