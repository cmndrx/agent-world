// Restricted Markdown. Raw HTML is always escaped; links use an explicit protocol allowlist.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function inline(text){
 const tokens=[];const token=html=>'\u0000'+(tokens.push(html)-1)+'\u0000';
 let s=String(text).replace(/\u0000/g,'');
 s=s.replace(/`([^`\n]+)`/g,(_,v)=>token('<code>'+esc(v)+'</code>'));
 s=s.replace(/!?\[([^\]\n]+)\]\(([^\s)]+)\)/g,(_,label,url)=>{
  const safe=/^(https?:\/\/|mailto:)/i.test(url);return token(safe?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label));
 });
 s=esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/~~([^~\n]+)~~/g,'<del>$1</del>');
 return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]||'');
}
export function markdown(text){
 const lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0;
 while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}
  if(/^\s*```/.test(line)){const lang=line.trim().slice(3).replace(/[^\w+-]/g,'');const code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);i++;out.push(`<pre><code${lang?` class="language-${lang}"`:''}>${esc(code.join('\n'))}</code></pre>`);continue;}
  const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);i++;continue;}
  if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){out.push('<hr>');i++;continue;}
  if(/^\s*>/.test(line)){const q=[];while(i<lines.length&&/^\s*>/.test(lines[i]))q.push(lines[i++].replace(/^\s*>\s?/,''));out.push('<blockquote>'+markdown(q.join('\n'))+'</blockquote>');continue;}
  const list=line.match(/^\s*(?:([-+*•])|(\d+)[.)])\s+(.+)$/);if(list){const ordered=!!list[2],items=[];while(i<lines.length){const m=lines[i].match(/^\s*(?:([-+*•])|(\d+)[.)])\s+(.+)$/);if(!m||!!m[2]!==ordered)break;items.push('<li>'+inline(m[3])+'</li>');i++;}const tag=ordered?'ol':'ul';out.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
  if(line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')){const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());const head=cells(line);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(cells(lines[i++]));out.push('<div class="markdown-table"><table><thead><tr>'+head.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;}
  const p=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,6}\s|\s*```|\s*>|\s*(?:[-+*•]|\d+[.)])\s)/.test(lines[i]))p.push(lines[i++]);out.push('<p>'+inline(p.join('\n')).replaceAll('\n','<br>')+'</p>');
 }
 return out.join('');
}
export function progressHtml(entries=[]){
 const visible=entries.some(e=>e.kind==='commentary')?entries.filter(e=>e.kind==='commentary'||e.kind==='action'):entries;
 const items=[];for(const e of visible){const previous=items.at(-1);if(e.kind==='action'&&previous?.kind==='action'&&previous.text===e.text){previous.count++;continue;}items.push({...e,count:1});}
 return items.map(e=>e.kind==='action'?`<div class="chat-tool-step"><span aria-hidden="true">↳</span> ${esc(e.text)}${e.count>1?' × '+e.count:''}</div>`:`<div class="chat-progress-text">${markdown(e.text)}</div>`).join('');
}
