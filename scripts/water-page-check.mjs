import {build} from 'esbuild';
import {parse,compileScript} from '@vue/compiler-sfc';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),temp=await mkdtemp(path.join(tmpdir(),'water-page-check-'));
try{
 const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';import {createSSRApp} from 'vue';import {renderToString} from '@vue/server-renderer';
import Designer from './src/components/WaterAdjustmentDesigner.vue';import Sources from './src/components/WaterSourcePage.vue';import Targets from './src/components/WaterTargetPage.vue';import Summary from './src/components/WaterAdjustmentSummary.vue';import TaskDrawer from './src/components/WaterAdjustmentTaskDrawer.vue';import {emptyWater,calculateWater,copy} from './src/water-chemistry.js';
const water=emptyWater();water.enabled=true;water.source={id:'1',factory_id:'1',name:'测试原水',measured_on:'2026-10-30',ions:{ca:30,mg:5,na:10,cl:20,so4:30,hco3:80},alkalinity:65.56};water.stages.mash.additions.gypsum.amount=100;
const snapshot={...copy(water),recipe_stage:{...copy(water.stages.mash),volume_l:1000},planned_result:calculateWater(water,water.stages.mash,1000)};
for(const [Component,props,expected] of [[Designer,{modelValue:water,factoryId:'1',mashVolume:1000,spargeVolume:400,readOnly:true},['测试原水','糖化水','洗糟水','二水硫酸钙','预计调整结果']],[Designer,{modelValue:{...copy(water),source:null},factoryId:'1',mashVolume:1000,spargeVolume:400},['请选择酒厂水源','未知离子不会按零处理']],[Sources,{},['水源水质','还没有水源水质档案']],[Targets,{},['酒品水质目标','暂无该酒品的目标水质方案']],[Summary,{snapshot},['测试原水','计划水质方案']],[TaskDrawer,{item:{water_adjustment:snapshot,title:'糖化水水质调节'}},['实际处理水量','实际投加量','确认实际投加并完成']]]){
 const warnings=[];const app=createSSRApp(Component,props);app.config.warnHandler=m=>warnings.push(m);const ctx={};const html=await renderToString(app,ctx);const full=html+Object.values(ctx.teleports||{}).join('');assert.equal(warnings.length,0,warnings.join(' / '));for(const text of expected)assert(full.includes(text),text);
}
console.log('PASS: water-source, recipe water designer, empty-source guidance, execution drawer and immutable summary render without Vue warnings');
`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'vue-and-read-fixture',setup(build){build.onLoad({filter:/\/api\.js$/},()=>({contents:"export const brewApi={getWaterSources:async()=>({items:[],factories:[],can_manage:false}),getWaterTargets:async()=>({items:[],products:[],factories:[],can_manage:false})};",loader:'js'}));build.onLoad({filter:/\.vue$/},async args=>{const {descriptor}=parse(await readFile(args.path,'utf8'),{filename:args.path});return {contents:compileScript(descriptor,{id:args.path,inlineTemplate:true}).content,loader:'js',resolveDir:path.dirname(args.path)};});}}]});
 const file=path.join(temp,'check.mjs');await writeFile(file,result.outputFiles[0].text);await import(pathToFileURL(file).href);
}finally{await rm(temp,{recursive:true,force:true});}
