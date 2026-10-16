export const ACTIVITY_SCHEMA='melodymorph-activity/1';
export const SOUND_SET='musyngkite-musedlab-6/v1';
export const SOUND_SETS=Object.freeze(['musyngkite-musedlab-5/v1',SOUND_SET]);
export const PLAYBACK_BEHAVIOR=Object.freeze({path_crossings:'restart-crossings/v1',direct_tap:'toggle/v1',path_loops:'end-in-start-circle/v1'});
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const SHARE_TOKEN=/^[A-Za-z0-9_-]{43}$/;
export function requireFields(value,required,optional=[]){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))throw Error('Unsupported activity fields.');}
export function validateBehavior(value){requireFields(value,Object.keys(PLAYBACK_BEHAVIOR));if(Object.entries(PLAYBACK_BEHAVIOR).some(([key,v])=>value[key]!==v))throw Error('This activity needs a different playback version.');return {...PLAYBACK_BEHAVIOR};}
export function validateOrigin(value){
 requireFields(value,['schema','activity_id','version_id','terrain_id','terrain_revision','title','attribution','behavior','sound_set']);
 if(value.schema!=='melodymorph-origin/1'||![value.activity_id,value.version_id,value.terrain_id].every(v=>typeof v==='string'&&UUID.test(v))||!Number.isSafeInteger(value.terrain_revision)||value.terrain_revision<1||![value.title,value.attribution].every(v=>typeof v==='string'&&v.length<=100)||!SOUND_SETS.includes(value.sound_set))throw Error('Invalid activity origin.');
 return {...value,behavior:validateBehavior(value.behavior)};
}
export function validateLibraryOrigin(value){
 requireFields(value,['schema','library_id','version_id','terrain_revision','title','attribution','behavior','sound_set']);
 if(value.schema!=='melodymorph-library-origin/1'||![value.library_id,value.version_id].every(v=>typeof v==='string'&&UUID.test(v))||!Number.isSafeInteger(value.terrain_revision)||value.terrain_revision<1||![value.title,value.attribution].every(v=>typeof v==='string'&&v.length<=100)||!SOUND_SETS.includes(value.sound_set))throw Error('Invalid library origin.');
 return {...value,behavior:validateBehavior(value.behavior)};
}
