import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserFeed} from '../bridge/browser-feed.mjs';
const event=(code,content=[],extra={})=>({type:'item.completed',item:{type:'mcp_tool_call',server:'cua_repl',tool:'js',arguments:{code},result:{content},...extra}});
const bind='let awBrowserTab = await cua.createBrowserTab("chrome", "http://localhost:4777/", {sessionName:"Agent World task"});';
const shot='await awBrowserTab.getScreenshot();';
const image={type:'image',mimeType:'image/jpeg',data:'aGVsbG8='};
test('only a dedicated browser in the exact run may emit feed images',()=>{
 const feed=new BrowserFeed();assert.equal(feed.consume('a',event(shot,[image])),false);
 feed.consume('a',event(bind));assert.equal(feed.consume('a',event(shot,[image]),123),true);
 assert.equal(feed.frame('a').capturedAt,123);assert.equal(feed.frame('b'),undefined);
 assert.equal(feed.consume('a',event('await someApp.getScreenshot();',[image])),false);
 assert.equal(feed.consume('a',event(shot,[image],{error:'denied'})),false);
 assert.equal(feed.consume('a',event(shot,[{...image,mimeType:'image/svg+xml'}])),false);
 assert.equal(feed.consume('a',event(shot,[{...image,data:'<script>'}])),false);
 assert.equal(feed.consume('a',event(shot,[image,image])),false);
 assert.equal(feed.consume('a',event(shot,[{...image,data:'a'.repeat(2*1024*1024+1)}])),false);
 feed.consume('a',event('awBrowserTab = await cua.getApp("Mail");'));
 assert.equal(feed.frame('a'),null);assert.equal(feed.consume('a',event(shot,[image])),false);
 assert.equal(feed.view({id:'a',status:'completed'}).capture,'unavailable');
});
test('bounded transient retention and metadata without pixels',()=>{
 const feed=new BrowserFeed();for(let i=0;i<10;i++){feed.consume(String(i),event(bind));feed.consume(String(i),event(shot,[image]),i+1);}
 assert.equal(feed.runs.size,8);assert.equal(feed.frame('0'),undefined);
 assert.equal(feed.view({id:'9',status:'cancelled'}).status,'cancelled');
 assert.equal('data' in feed.view({id:'9'}),false);assert.equal(new BrowserFeed().frame('9'),undefined);
});
