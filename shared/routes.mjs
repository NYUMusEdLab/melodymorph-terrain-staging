// Deliberately finite: never copy location.href, session tokens, or user content.
const base='https://ruthmann.github.io/rengongfu-sandbox/workbench/';
export const SHARE_ROUTES=Object.freeze(Object.fromEntries([
 ['preview_hub','MusEDLab tool previews','MusEDLab 工具预览','https://workshop.musedlab.org/','hub'],
 ['workshop','Workshop','工作坊',base+'weekend/','hub'],
 ['workshop_signin','Workshop sign-in','工作坊登录',base+'teacher-pilot/phone.html','restricted'],
 ['melodymorph','MelodyMorph','MelodyMorph','https://terrain-staging.musedlab.org/','tool'],
 ['loop_lab','Loop Lab','Loop Lab',base+'tools/loop-lab/','tool'],
 ['rhythm_experiment','Rhythm Experiment','节奏实验',base+'tools/rhythm-experiment/','tool'],
 ['song_studio','Song Studio','Song Studio','https://www.musedlab.org/review/song-studio-20261014/','tool'],
 ['aqwertyon','aQWERTYon','aQWERTYon','https://nyumusedlab.github.io/aqwertyon-preview/','tool'],
 ['virtual_duet','Virtual Piano Duet','虚拟钢琴二重奏','https://apps.musedlab.org/virtualduet/cmsd/v2/','tool'],
 ['singing_capture','Performance Mirror','听见·看见',base+'tools/singing-capture/','tool'],
 ['singing_notebook','Singing Notebook','歌唱笔记本',base+'tools/singing-capture/notebook.html','tool']
].map(([id,en,zh,url,kind])=>[id,Object.freeze({id,en,zh,url,kind})])));
export const languageOf=value=>/^zh(?:-cn|-hans)?$/i.test(value||'')?'zh':'en';
export function shareLink(id,language='en'){
 const route=Object.hasOwn(SHARE_ROUTES,id)?SHARE_ROUTES[id]:null;
 if(!route)throw new TypeError('Unsupported share destination');
 const url=new URL(route.url);url.searchParams.set('lang',languageOf(language));return url.href;
}
// Matching uses only canonical origin/path; the returned link is rebuilt above.
export function routeForLink(href,baseUrl){
 let url;try{url=new URL(href,baseUrl);}catch{return null;}
 return Object.values(SHARE_ROUTES).find(r=>{const clean=new URL(r.url);return clean.origin===url.origin&&clean.pathname===url.pathname;})?.id??null;
}
