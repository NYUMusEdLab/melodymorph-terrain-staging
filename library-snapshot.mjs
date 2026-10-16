import {musicalSnapshot,requiredInstruments} from './activity-snapshot.mjs';
import {UUID,SOUND_SET,SOUND_SETS,validateBehavior,validateLibraryOrigin} from './activity-contract.mjs';
import {validateDescription} from './description-contract.mjs';
export function validateLibrarySnapshot(value){
 if(!value||value.schema!=='melodymorph-library/1'||![value.id,value.version_id].every(v=>typeof v==='string'&&UUID.test(v))||![value.revision,value.content_revision].every(v=>Number.isSafeInteger(v)&&v>0)||![value.title,value.attribution].every(v=>typeof v==='string'&&v.length<=100)||!value.title.trim()||!validateDescription(value.description)||typeof value.allow_remix!=='boolean')throw Error('Invalid shared terrain.');
 const project=musicalSnapshot(value.project),behavior=validateBehavior(value.behavior),required=requiredInstruments(project);
 if(!SOUND_SETS.includes(value.sound_set)||(value.sound_set!==SOUND_SET&&required.includes('bowed'))||JSON.stringify(value.required_instruments)!==JSON.stringify(required))throw Error('This terrain needs a different sound set.');
 if(project.title!==value.title||(project.description||'')!==value.description)throw Error('The terrain does not match its shared description.');
 return {id:value.id,version_id:value.version_id,revision:value.revision,content_revision:value.content_revision,title:value.title,description:value.description,attribution:value.attribution,allow_remix:value.allow_remix,behavior,sound_set:value.sound_set,required_instruments:required,project};
}
export function remixLibrarySnapshot(raw){
 const value=validateLibrarySnapshot(raw);if(!value.allow_remix)throw Error('The creator has not permitted remixes.');
 const project=musicalSnapshot(value.project);project.title=(value.title.slice(0,92)+' (remix)').slice(0,100);
 project.library_origin=validateLibraryOrigin({schema:'melodymorph-library-origin/1',library_id:value.id,version_id:value.version_id,terrain_revision:value.content_revision,title:value.title,attribution:value.attribution,behavior:value.behavior,sound_set:value.sound_set});
 return project;
}
