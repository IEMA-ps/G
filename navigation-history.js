// Seed one local fallback only for direct entry, not every Back. No endless Back trap.
export function seedHistory(fallback,current,{history=window.history,location=window.location,referrer=document.referrer}={}){
 if(history.state?.localEntry)return;
 let internal=false;try{internal=new URL(referrer).origin===location.origin;}catch{}
 if(!internal){history.replaceState({localEntry:true,localDepth:0},'',fallback);history.pushState({localEntry:true,localDepth:1},'',current);}
 else history.replaceState({...history.state,localEntry:true,localDepth:1},'',current);
}
export function previousOr(fallback,{history=window.history,location=window.location}={}){if(history.state?.localDepth>0)history.back();else location.assign(fallback);}
