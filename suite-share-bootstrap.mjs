import {mountShare} from './shared/share.mjs';
if(!new URLSearchParams(location.search).has('activity-preview'))mountShare({mount:document.getElementById('suiteShareMount'),toolId:'melodymorph'});
