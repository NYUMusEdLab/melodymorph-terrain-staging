// Save while navigation is still cancellable. pagehide alone is too late.
export function installPersistenceGuard({windowObject=window,documentObject=document,prepare,onBlocked=()=>{}}){
 const w=windowObject,d=documentObject;
 const attempt=()=>{try{return prepare()===true;}catch{return false;}};
 const blocked=e=>{e.preventDefault();onBlocked();};
 const beforeUnload=e=>{if(!attempt()){blocked(e);e.returnValue='';}};
 const click=e=>{
  const a=e.target?.closest?.('a[href]');
  if(!a||e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
  const target=new URL(a.href,d.baseURI),current=new URL(w.location.href);
  // A fragment change does not unload the composition.
  if(target.origin===current.origin&&target.pathname===current.pathname&&target.search===current.search&&target.hash)return;
  if(!attempt())blocked(e);
 };
 const pageHide=()=>{attempt();};
 const visibility=()=>{if(d.hidden)attempt();};
 w.addEventListener('beforeunload',beforeUnload);
 d.addEventListener('click',click,true);
 w.addEventListener('pagehide',pageHide);
 d.addEventListener('visibilitychange',visibility);
 return ()=>{w.removeEventListener('beforeunload',beforeUnload);d.removeEventListener('click',click,true);w.removeEventListener('pagehide',pageHide);d.removeEventListener('visibilitychange',visibility);};
}
