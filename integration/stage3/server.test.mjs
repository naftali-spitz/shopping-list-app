import {test} from 'node:test';
import assert from 'node:assert/strict';
import {developmentConfig,handle,stage4Enabled} from './server.mjs';
import {DEV_SUPABASE} from './identity.mjs';
const safe={SHOPPING_STAGE3_ENABLED:'1',VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:DEV_SUPABASE,VERCEL_GIT_COMMIT_REF:'feature/flespi-home-backend',VERCEL_GIT_REPO_OWNER:'naftali-spitz',VERCEL_GIT_REPO_SLUG:'shopping-list-app',SHOPPING_STAGE3_CONFIG:JSON.stringify({projectId:'prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM',topic:'shopping-poc/naf-stage0-041d4f122bdd/commands'})};
test('backend flag and every development deployment guard are required',()=>{
  developmentConfig(safe);
  for(const patch of [{SHOPPING_STAGE3_ENABLED:'0'},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_GIT_REPO_OWNER:'foreign'},{VERCEL_GIT_REPO_SLUG:'foreign'},{NEXT_PUBLIC_SUPABASE_URL:'https://inebdmynrfwmmxcyziyi.supabase.co'},{SHOPPING_STAGE3_CONFIG:'{}'}])assert.throws(()=>developmentConfig({...safe,...patch}));
  assert.throws(()=>developmentConfig({...safe,VERCEL_ENV:'production',SHOPPING_STAGE3_LOCAL:'1'}));
});
test('Stage4 command intake requires its own flag and exact feature Preview while Stage3 fallback remains',()=>{
  assert.equal(stage4Enabled({...safe,SHOPPING_STAGE4_ENABLED:'1'}),true);
  for(const patch of [{SHOPPING_STAGE4_ENABLED:'0'},{SHOPPING_STAGE4_ENABLED:undefined},{VERCEL_GIT_COMMIT_REF:'develop'},{VERCEL_ENV:'production'},{SHOPPING_STAGE3_ENABLED:'0'}])assert.equal(stage4Enabled({...safe,SHOPPING_STAGE4_ENABLED:'1',...patch}),false);
  developmentConfig({...safe,VERCEL_GIT_COMMIT_REF:'develop'});
});
test('disabled API returns404 before accepting any command or loading credentials',async()=>{
  const previous=process.env.SHOPPING_STAGE3_ENABLED;
  try {process.env.SHOPPING_STAGE3_ENABLED='0';assert.equal((await handle(new Request('https://development.invalid/api/stage3',{method:'POST',body:'malformed'}))).status,404);}
  finally{if(previous===undefined)delete process.env.SHOPPING_STAGE3_ENABLED;else process.env.SHOPPING_STAGE3_ENABLED=previous;}
});
