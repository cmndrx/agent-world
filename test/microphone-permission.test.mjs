import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const main=fs.readFileSync(new URL('../electron/main.cjs',import.meta.url),'utf8');
const start=main.indexOf('function installMicrophonePermission('),end=main.indexOf('\nlet taskBrowsers',start);
const installMicrophonePermission=vm.runInNewContext(main.slice(start,end)+';installMicrophonePermission',{URL,process});
const permissions={installMicrophonePermission};
function fixture(initial='not-determined'){
 let request,check,status=initial,asks=0,url='http://127.0.0.1:4777/';
 const wc={getURL:()=>url,isDestroyed:()=>false,session:{setPermissionRequestHandler:f=>request=f,setPermissionCheckHandler:f=>check=f}};
 const preferences={getMediaAccessStatus:()=>status,askForMediaAccess:async()=>{asks++;status='granted';return true;}};
 permissions.installMicrophonePermission({webContents:wc},preferences,{platform:'darwin'});
 const details={isMainFrame:true,mediaTypes:['audio'],requestingUrl:url};
 return {wc,details,ask:(sender=wc,d=details,permission='media')=>new Promise(resolve=>request(sender,permission,resolve,d)),check:(origin=url,type='audio')=>check(wc,'media',origin,{mediaType:type}),asks:()=>asks,setURL:value=>url=value};
}
test('local game audio requests explicitly obtain native macOS microphone consent once',async()=>{
 const f=fixture();assert.equal(f.asks(),0);assert.equal(f.check(),false);assert.equal(await f.ask(),true);assert.equal(f.check(),true);assert.equal(f.asks(),1);assert.equal(await f.ask(),true);assert.equal(f.asks(),1);
});
test('denied OS microphone access never becomes silent granted capture',async()=>{
 const f=fixture('denied');assert.equal(f.check(),false);assert.equal(await f.ask(),false);assert.equal(f.asks(),0);
});
test('camera, remote pages, cross-origin frames and other windows get no microphone grant',async()=>{
 const f=fixture();assert.equal(await f.ask({},f.details),false);assert.equal(await f.ask(f.wc,{...f.details,isMainFrame:false}),false);
 assert.equal(await f.ask(f.wc,{...f.details,mediaTypes:['audio','video']}),false);assert.equal(await f.ask(f.wc,{...f.details,requestingUrl:'http://127.0.0.1:3000/'}),false);
 assert.equal(await f.ask(f.wc,f.details,'geolocation'),false);assert.equal(f.check('https://foreign.invalid'),false);assert.equal(f.check(undefined,'video'),false);assert.equal(f.asks(),0);
 f.setURL('https://foreign.invalid/');assert.equal(await f.ask(),false);
});
test('macOS packaging signs the app and capture helpers with the audio-input entitlement',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(config.build.mac.entitlements,'electron/entitlements.mac.plist');assert.equal(config.build.mac.entitlementsInherit,config.build.mac.entitlements);
 const plist=fs.readFileSync(new URL('../electron/entitlements.mac.plist',import.meta.url),'utf8');
 assert.match(plist,/<key>com.apple.security.device.audio-input<\/key>\s*<true\/>/);
 for(const key of ['allow-jit','allow-unsigned-executable-memory','disable-library-validation'])assert.ok(plist.includes('com.apple.security.cs.'+key));
});
