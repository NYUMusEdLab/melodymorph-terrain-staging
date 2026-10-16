import {SHARE_ROUTES,shareLink,languageOf} from './routes.mjs';
const words={
 en:{share:'Share',close:'Close',open:'Open this tool',hub:'Open this page',restricted:'Open workshop sign-in',notice:'This link opens the tool. Your current work is not included.',hubNotice:'This link opens the tool list. It does not share saved work or workshop sessions.',restrictedNotice:'Recipients must sign in with their own workshop account. This link does not grant access to your account or sessions.',url:'Link',copy:'Copy link',copied:'Link copied.',select:'Select link',selected:'Link selected. Use your device’s Copy command.',failedCopy:'Could not copy automatically. The link is selected; use your device’s Copy command.',download:'Download QR',downloaded:'QR download requested. Check your downloads or save prompt.',large:'Projector view',small:'Exit projector view',scan:'Scan to open',loading:'Preparing QR…',qrError:'QR unavailable. Copy or select the link instead.',language:'Switch to 中文',downloadError:'Could not download the QR. Try again or copy the link.'},
 zh:{share:'分享',close:'关闭',open:'打开此工具',hub:'打开此页面',restricted:'打开工作坊登录页',notice:'此链接仅打开工具，不包含你当前的作品。',hubNotice:'此链接打开工具列表，不会分享已保存的作品或工作坊会话。',restrictedNotice:'接收者需要使用自己的工作坊账号登录。此链接不会授予访问你的账号或会话的权限。',url:'链接',copy:'复制链接',copied:'已复制链接。',select:'选择链接',selected:'已选中链接。请使用设备的“复制”命令。',failedCopy:'无法自动复制。已选中链接，请使用设备的“复制”命令。',download:'下载二维码',downloaded:'已请求下载二维码。请查看下载列表或保存提示。',large:'投影模式',small:'退出投影模式',scan:'扫码打开',loading:'正在生成二维码…',qrError:'二维码暂不可用，请复制或选择链接。',language:'Switch to English',downloadError:'无法下载二维码。请重试或复制链接。'}
};
const shareIcon='<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4"/></svg>';
const docLanguage=()=>languageOf(document.documentElement.lang);
let nextId=0;
export function mountShare({mount,toolId,getLanguage=docLanguage,onLanguageChange=null,compactLanguage=false}={}){
 if(!(mount instanceof Element)||!Object.hasOwn(SHARE_ROUTES,toolId))throw new TypeError('A mount and registered toolId are required');
 // An integration can call this again without adding duplicate controls/listeners.
 const existing=[...mount.children].find(n=>n.dataset?.rgfShare===toolId);
 if(existing)return existing.shareController;
 const route=SHARE_ROUTES[toolId],id='rgf-share-'+(++nextId),host=document.createElement('span');
 host.dataset.rgfShare=toolId;host.dataset.noTranslate='';host.style.display='inline-flex';
 const root=host.attachShadow({mode:'open'}),css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./share.css',import.meta.url).href;root.append(css);
 const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
 const button=(className,action)=>{const n=el('button',className);n.type='button';n.addEventListener('click',action);return n;};
 const controls=el('span','controls'),opener=button('circle',()=>open());opener.innerHTML=shareIcon;opener.setAttribute('aria-haspopup','dialog');
 controls.append(opener);
 let languageButton;if(compactLanguage&&typeof onLanguageChange==='function'){
  languageButton=button('circle language',()=>onLanguageChange(languageOf(getLanguage())==='en'?'zh':'en'));
  languageButton.addEventListener('pointerdown',e=>{if(e.button===0)e.preventDefault();});controls.append(languageButton);
 }
 const dialog=el('dialog','share-dialog');dialog.setAttribute('aria-labelledby',id+'-title');dialog.setAttribute('aria-describedby',id+'-notice');
 const top=el('div','top'),heading=el('h2'),close=button('circle close',()=>dialog.close());heading.id=id+'-title';close.textContent='×';top.append(heading,close);
 const kind=el('p','kind'),notice=el('p','notice');notice.id=id+'-notice';
 const qrGroup=el('div','qr-group'),qr=el('canvas'),caption=el('p','caption'),qrStatus=el('p','qr-status');qr.setAttribute('role','img');qr.hidden=true;qrGroup.append(qr,caption,qrStatus);
 const field=el('div','link-field'),label=el('label'),input=el('input');input.id=id+'-url';input.type='url';input.readOnly=true;input.spellcheck=false;input.autocomplete='off';input.setAttribute('autocapitalize','off');label.htmlFor=input.id;field.append(label,input);
 const actions=el('div','actions'),copy=button('primary',()=>copyLink()),select=button('',()=>selectLink()),download=button('',()=>downloadQr()),projector=button('',()=>{dialog.classList.toggle('projector');render();});
 actions.append(copy,select,download,projector);const status=el('p','status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 dialog.append(top,kind,notice,qrGroup,field,actions,status);root.append(controls,dialog);mount.append(host);
 let language,qrText=null,request=0,destroyed=false;
 const text=()=>words[languageOf(getLanguage())];
 const say=message=>{status.textContent=message;};
 function render(){
  language=languageOf(getLanguage());const w=words[language],name=route[language];host.lang=language==='zh'?'zh-CN':'en';
  opener.title=opener.ariaLabel=w.share+' · '+name;
  if(languageButton){languageButton.textContent=language==='en'?'EN':'中';languageButton.title=languageButton.ariaLabel=w.language;}
  heading.textContent=w.share+' · '+name;kind.textContent=w[route.kind==='hub'?'hub':route.kind==='restricted'?'restricted':'open'];
  notice.textContent=w[route.kind==='hub'?'hubNotice':route.kind==='restricted'?'restrictedNotice':'notice'];
  close.title=close.ariaLabel=w.close;caption.textContent=w.scan+' · '+name;qr.ariaLabel=caption.textContent;label.textContent=w.url;
  const url=shareLink(toolId,language);input.value=url;copy.textContent=w.copy;select.textContent=w.select;download.textContent=w.download;
  projector.textContent=dialog.classList.contains('projector')?w.small:w.large;projector.setAttribute('aria-pressed',String(dialog.classList.contains('projector')));
  status.textContent='';if(dialog.open&&url!==qrText)refreshQr(url);
 }
 async function refreshQr(url){
  const serial=++request;qrText=url;qr.hidden=true;download.disabled=true;qrStatus.hidden=false;qrStatus.textContent=text().loading;
  try{const {drawQr}=await import('./qr.mjs');if(destroyed||serial!==request)return;drawQr(qr,url);qr.hidden=false;qrStatus.hidden=true;download.disabled=false;}
  catch{if(serial===request&&!destroyed){qrStatus.textContent=text().qrError;qrText=null;}}
 }
 function open(){if(destroyed)return;render();if(!dialog.open)dialog.showModal();refreshQr(input.value);close.focus();}
 function selectLink(message=text().selected){input.focus();input.select();input.setSelectionRange(0,input.value.length);say(message);}
 async function copyLink(){const value=input.value;try{await navigator.clipboard.writeText(value);if(dialog.open&&value===input.value)say(text().copied);}catch{if(dialog.open)selectLink(text().failedCopy);}}
 async function downloadQr(){
  if(download.disabled||qr.hidden)return;
  // Snapshot before yielding: an in-place language switch cannot rename old QR bytes.
  const name=toolId+'-'+language+'-qr.png';
  try{const blob=await new Promise(resolve=>qr.toBlob(resolve,'image/png'));if(!blob)throw Error('No image');
   if(destroyed)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;root.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);say(text().downloaded);
  }catch{say(text().downloadError);}
 }
 // Keep tool keyboard shortcuts from receiving modal keystrokes. Native Tab/Escape still work.
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')return;
  if(e.key==='Tab'){const items=[close,input,copy,select,download,projector].filter(n=>!n.disabled),first=items[0],last=items.at(-1),active=root.activeElement;
   if(e.shiftKey&&active===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}}
 });
 for(const event of ['keyup','keypress','pointerdown','pointerup','click'])dialog.addEventListener(event,e=>e.stopPropagation());
 dialog.addEventListener('close',()=>{dialog.classList.remove('projector');render();if(!destroyed&&opener.isConnected)opener.focus();});
 const observer=new MutationObserver(()=>render());observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const controller={open,refresh:render,destroy(){destroyed=true;request++;observer.disconnect();if(dialog.open)dialog.close();host.remove();}};
 host.shareController=controller;render();return controller;
}
