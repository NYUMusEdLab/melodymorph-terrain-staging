// Optional integration seam. No storage, identifiers, timers or network requests.
// The workshop owner supplies its existing consent-gated reporter. Standalone is off.
export const ACTIONS=Object.freeze(['tray_audition','bell_place','bell_play','phrase_play','phrase_stop','path_play','path_stop','strum_gesture','line_draw','path_draw','object_move','pitch_change','object_remove','record_start','record_finish','mode_change','display_change','timbre_change','undo','redo','landscape_new','example_open','import_complete','import_rejected','export_requested','stop_all']);
export function createActivityChannel(){
 let send=null,enabled=false;
 return {
  attach(sink){if(typeof sink!=='function')throw new TypeError('A workshop reporter function is required.');send=sink;enabled=false;},
  setEnabled(value){enabled=value===true&&typeof send==='function';},
  detach(){enabled=false;send=null;},
  report(action){if(!enabled||!ACTIONS.includes(action))return false;try{return send({action})!==false;}catch{return false;}},
  get enabled(){return enabled;}
 };
}
export const workshopActivity=createActivityChannel();
export const reportActivity=action=>workshopActivity.report(action);
