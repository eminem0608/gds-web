import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copy,emptyWater,calculateWater,scaleWaterAdditions,waterDesignVolumes,defaultWaterTarget} from '../src/water-chemistry.js';
const w=emptyWater();w.enabled=true;w.source={ions:{ca:30,mg:5,na:10,cl:20,so4:30,hco3:80},alkalinity:65.56};w.stages.mash.additions.gypsum.amount=100;w.stages.mash.additions.calcium_chloride.amount=100;
let result=calculateWater(w,w.stages.mash,1000);assert(Math.abs(result.ions.ca-80.538)<1e-8);assert(Math.abs(result.ions.cl-68.23)<1e-8);
const variants=[copy(w),{...copy(w),dilution_percent:50},copy(w)];variants[2].stages.mash.acid.amount_ml=100;
const python=`import json,sys,importlib.util;from pathlib import Path;p=Path('odoo/addons/craft_brew_workflow/models/water_chemistry.py');s=importlib.util.spec_from_file_location('water',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);items=json.load(sys.stdin);print(json.dumps([m.calculate_stage(w,w['stages']['mash'],1000) for w in items]))`;
const expected=JSON.parse(execFileSync('python3',['-c',python],{input:JSON.stringify(variants),cwd:new URL('../..',import.meta.url),encoding:'utf8'}));
for(let i=0;i<variants.length;i++){const r=calculateWater(variants[i],variants[i].stages.mash,1000);for(const key of Object.keys(r.ions)){if(expected[i].ions[key]===null)assert.equal(r.ions[key],null);else assert(Math.abs(r.ions[key]-expected[i].ions[key])<1e-8,key);}for(const key of ['hardness','alkalinity_estimate','acid_neutralization','ratio'])assert(Math.abs(r[key]-expected[i][key])<1e-8,key);}
for(const value of ['',null,NaN,-1,true]){const invalid=copy(w);invalid.source.ions.ca=value;assert.throws(()=>calculateWater(invalid,invalid.stages.mash,1000));}
const design={water_adjustment:copy(w),fermentables:[{quantity:100}],mash:{water_grain_ratio:3,sparge_water_liters:[200]}};const old=waterDesignVolumes(design);design.fermentables[0].quantity=50;design.mash.sparge_water_liters=[100];scaleWaterAdditions(design,old);assert.equal(design.water_adjustment.stages.mash.additions.gypsum.amount,50);assert.equal(w.stages.mash.additions.gypsum.amount,100);
console.log('PASS: front/back ion, dilution and acid calculations agree; missing data, hydrated salts and batch scaling checked');

const common={id:'common',active:true,is_default:true,product_id:'1',factory_id:''};
const local={...common,id:'local',factory_id:'10'};
const foreign={...common,id:'foreign',factory_id:'20'};
assert.equal(defaultWaterTarget([common,foreign,local],'1','10').id,'local');
assert.equal(defaultWaterTarget([common,foreign],'1','10').id,'common');
assert.equal(defaultWaterTarget([{...local,active:false},common],'1','10').id,'common');
assert.equal(defaultWaterTarget([common],'2','10'),null);
assert.equal(defaultWaterTarget([{...common,is_default:false}],'1','10'),null);
console.log('PASS: product-scoped default selection prefers local, falls back to HQ, excludes inactive and unrelated targets');
