// Owner-only, development-only bounded test controls. Disabled by default and
// never present in a Vercel bundle or browser request contract.
import {readFileSync,writeFileSync,statSync} from 'node:fs';
const path='.stage0-runtime/stage3-fault.json';
export function faults(config) {
  if(config.protocolVersion!==2 || config.faultInjectionEnabled!==true)return {};
  try {
    if((statSync(path).mode&0o777)!==0o600 || statSync(path).uid!==process.getuid())return {};
    const value=JSON.parse(readFileSync(path));
    if(!Number.isSafeInteger(value.until) || value.until<Date.now() || value.until>Date.now()+610000)return {};
    return value;
  }catch{return {};}
}
export function consumeFault(config,field,id) {
  const current=faults(config);if(current[field]!==id)return false;
  delete current[field];writeFileSync(path,JSON.stringify(current),{mode:0o600});return true;
}
