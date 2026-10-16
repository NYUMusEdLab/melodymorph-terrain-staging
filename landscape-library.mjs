import {blank,clone,validate} from './model.mjs';

export const LIBRARY_SCHEMA='melodymorph-library/1';
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=100;
export function validateLibrary(value){
  if(value?.schema!==LIBRARY_SCHEMA||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>200)throw Error('Invalid landscape library.');
  const ids=new Set();
  const entries=value.entries.map(entry=>{
    if(!validId(entry?.id)||ids.has(entry.id)||!Number.isFinite(entry.updated)||entry.updated<0)throw Error('Invalid library entry.');
    ids.add(entry.id);return {id:entry.id,updated:entry.updated,project:validate(entry.project)};
  });
  if(!ids.has(value.activeId))throw Error('Invalid active landscape.');
  return {schema:LIBRARY_SCHEMA,activeId:value.activeId,entries};
}

// One atomic library write keeps a successful switch and both landscapes together.
// The original single-landscape key is retained as a compatibility backup.
export class LandscapeLibrary{
  constructor({storage,key,legacyKey,id=()=>crypto.randomUUID(),now=()=>Date.now()}){
    this.storage=storage;this.key=key;this.legacyKey=legacyKey;this.id=id;this.now=now;
    this.raw=null;this.legacyRaw=null;this.problem=null;this.saved=false;this.readOnly=false;
    try{
      this.raw=storage.getItem(key);
      if(this.raw!==null){this.value=validateLibrary(JSON.parse(this.raw));this.saved=true;return;}
    }catch{this.problem='unreadable';this.readOnly=true;}
    let project=blank();
    try{this.legacyRaw=storage.getItem(legacyKey);if(this.legacyRaw)project=validate(JSON.parse(this.legacyRaw));}
    catch{this.problem=this.problem||'unreadable';this.readOnly=true;}
    const entry={id:id(),updated:now(),project};
    this.value={schema:LIBRARY_SCHEMA,activeId:entry.id,entries:[entry]};
  }
  get hasRecoveryData(){return this.readOnly&&(this.raw!==null||this.legacyRaw!==null);}
  recoveryData(current){return this.hasRecoveryData?{schema:'melodymorph-recovery/1',libraryRaw:this.raw,legacyRaw:this.legacyRaw,current:clone(current)}:null;}
  get current(){return clone(this.value.entries.find(e=>e.id===this.value.activeId).project);}
  get entries(){return this.value.entries.map(e=>({id:e.id,title:e.project.title,updated:e.updated,bells:e.project.bells.length,paths:e.project.paths.length,active:e.id===this.value.activeId})).sort((a,b)=>b.updated-a.updated);}
  prepare(project){
    const next=clone(this.value),entry=next.entries.find(e=>e.id===next.activeId);
    const validated=validate(project);if(JSON.stringify(entry.project)!==JSON.stringify(validated)){entry.project=validated;entry.updated=this.now();}return next;
  }
  commit(next){
    if(this.readOnly){this.saved=false;return {ok:false,reason:'unreadable'};}
    try{
      // Another open tab must not silently overwrite the library we loaded.
      if(this.storage.getItem(this.key)!==this.raw){this.saved=false;this.problem='conflict';return {ok:false,reason:'conflict'};}
      const text=JSON.stringify(next);
      if(text!==this.raw)this.storage.setItem(this.key,text);
      this.value=next;this.raw=text;this.saved=true;this.problem=null;
      try{this.storage.setItem(this.legacyKey,JSON.stringify(this.current));}catch{/* The atomic library remains saved. */}
      return {ok:true,project:this.current};
    }catch{this.saved=false;this.problem='storage';return {ok:false,reason:'storage'};}
  }
  save(project){
    try{return this.commit(this.prepare(project));}catch{this.saved=false;this.problem='invalid';return {ok:false,reason:'invalid'};}
  }
  create(current,project){
    try{
      const next=this.prepare(current);
      if(next.entries.length>=200)return {ok:false,reason:'full'};
      const entry={id:this.id(),updated:this.now(),project:validate(project)};
      next.entries.push(entry);next.activeId=entry.id;return this.commit(next);
    }catch{return {ok:false,reason:'invalid'};}
  }
  restore(current,project,existingId){
    try{
      const next=this.prepare(current),entry=existingId&&next.entries.find(e=>e.id===existingId);
      if(entry){entry.project=validate(project);entry.updated=this.now();next.activeId=entry.id;}
      else{if(next.entries.length>=200)return {ok:false,reason:'full'};const item={id:this.id(),updated:this.now(),project:validate(project)};next.entries.push(item);next.activeId=item.id;}
      return this.commit(next);
    }catch{return {ok:false,reason:'invalid'};}
  }
  open(current,id){
    try{
      const next=this.prepare(current);
      if(!next.entries.some(e=>e.id===id))return {ok:false,reason:'missing'};
      next.activeId=id;return this.commit(next);
    }catch{return {ok:false,reason:'invalid'};}
  }
}
