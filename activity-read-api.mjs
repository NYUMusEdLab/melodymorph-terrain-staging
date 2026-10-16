import {MAX_ACTIVITY_BYTES,parseActivity} from './activity-snapshot.mjs';
export async function readActivity(config,link,{fetcher=fetch,signal}={}){
 if(!config.enabled||!config.apiBase)throw Error('Activity sharing is not configured on this site yet.');
 const base=new URL(config.apiBase);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Activity sharing configuration is invalid.');
 const url=base.href.replace(/\/$/,'')+'/terrain/v1/activities/'+link.activity_id+'/'+link.share_token;
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{
 const response=await fetcher(url,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
 if(response.status===404)throw Error('This activity link is unavailable or has been withdrawn.');
 if(!response.ok)throw Error('The activity could not be loaded. Please try again.');
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('The activity response is invalid.');
 const declared=Number(response.headers.get('content-length'));if(declared>MAX_ACTIVITY_BYTES)throw Error('This activity is too large.');
 const reader=response.body?.getReader();let text;
 if(reader){const decoder=new TextDecoder(),parts=[];let bytes=0;for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>MAX_ACTIVITY_BYTES){await reader.cancel();throw Error('This activity is too large.');}parts.push(decoder.decode(item.value,{stream:true}));}parts.push(decoder.decode());text=parts.join('');}else text=await response.text();
 const activity=parseActivity(text);if(activity.activity_id!==link.activity_id)throw Error('The activity does not match this link.');return activity;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
