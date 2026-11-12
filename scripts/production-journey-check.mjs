// Render the real production detail payload without changing production data.
// Usage: node scripts/production-journey-check.mjs /path/to/progress-response.json
import { build } from 'esbuild';
import { parse, compileScript } from '@vue/compiler-sfc';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const fixture=path.resolve(process.argv[2]);
const temp=await mkdtemp(path.join(tmpdir(),'production-journey-check-'));
try {
 const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import Journey from './src/components/ProductionJourney.vue';
const detail=JSON.parse(readFileSync(${JSON.stringify(fixture)},'utf8'));
for(const stage of ['materials','mash','transfer','fermentation','liquid','packaging']){
 const warnings=[];const app=createSSRApp(Journey,{detail,initialStage:stage});
 app.config.warnHandler=message=>warnings.push(message);
 const html=await renderToString(app);
 assert.equal(warnings.length,0,warnings.join(' / '));
 assert(html.includes(detail.plan.name));
 assert(html.includes(detail.journey.batch.name));
 if(stage==='mash')assert(html.includes(detail.tasks.find(t=>t.task_type==='mashing').execution_checkpoints[0].title));
 if(stage==='liquid')assert(html.includes('本批次无需包装任务'));
 assert(!html.includes('包装与成品入库（可选）'));
}
const packed=structuredClone(detail);packed.plan.packaging_plan={packaging_id:'test',execution:{completed_at:'2026-10-30T08:00:00',output_volume_l:100,loss_volume_l:5}};
const html=await renderToString(createSSRApp(Journey,{detail:packed,initialStage:'packaging'}));
assert(html.includes('包装与成品入库（可选）'));assert(html.includes('包装产出 100 L'));assert(html.includes('尚无成品入库记录'));
console.log('PASS: all production detail stages render; raw-only batches need no packaging; optional packaging and stock remain distinct');
`,resolveDir:root,sourcefile:'production-journey-render-check.mjs'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'vue-sfc',setup(build){build.onLoad({filter:/\.vue$/},async args=>{const source=await readFile(args.path,'utf8');const {descriptor}=parse(source,{filename:args.path});return {contents:compileScript(descriptor,{id:args.path,inlineTemplate:true}).content,loader:'js',resolveDir:path.dirname(args.path)};});}}]});
 const target=path.join(temp,'check.mjs');await writeFile(target,result.outputFiles[0].text);await import(pathToFileURL(target).href);
}finally{await rm(temp,{recursive:true,force:true});}
