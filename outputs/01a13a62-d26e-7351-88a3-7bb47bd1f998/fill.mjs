import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';
const dir = new URL('.', import.meta.url).pathname;
const w = await SpreadsheetFile.importXlsx(await FileBlob.load(process.argv.includes('--roles') ? dir+'NR-Presentation-Challenges.xlsx' : '/Users/charbelnasr/Downloads/challenge-template.xlsx'));
const s = w.worksheets.getItemAt(0);
if(process.argv.includes('--roles')) {
  const original = s.getRange('A18:E18').values[0];
  const roles=['President','Vice President','Secretary','Public Relations and Media','Treasurer'];
  const rows=roles.map(role=>[...original.slice(0,3),role,`Develop and present a strategic plan outlining how you would contribute to the Lebanese Red Cross Youth Sector in the Executive Committee role of ${role}. Apply all Challenge 5 requirements to this role.`]);
  s.getRange('A18:E22').values=rows;
  s.getRange('A18:E22').format.wrapText=true;
  s.getRange('A18:E22').format.verticalAlignment='top';
  s.getRange('A18:E22').format.autofitRows();
  w.recalculate();
  console.log((await w.inspect({kind:'table',range:'Challenges!D18:E22',include:'values,formulas',maxChars:4000,tableMaxRows:5})).ndjson);
  const img=await w.render({sheetName:'Challenges',range:'D18:E22',scale:1,format:'png'});
  await fs.writeFile(dir+'roles.png',new Uint8Array(await img.arrayBuffer()));
  const out=await SpreadsheetFile.exportXlsx(w);
  await out.save(dir+'NR-Presentation-Challenges-21-Topics.xlsx');
  process.exit(0);
}
if(process.argv.includes('--preview')) {
  console.log((await w.inspect({kind:'table',range:'Challenges!A1:E2',include:'values,formulas',maxChars:2000})).ndjson);
  const img=await w.render({sheetName:'Challenges',range:'A1:E2',scale:1,format:'png'});
  await fs.writeFile(dir+'template.png',new Uint8Array(await img.arrayBuffer()));
  process.exit(0);
}
const paragraphs=JSON.parse(execFileSync('/Users/charbelnasr/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',['-c','from docx import Document; import json; print(json.dumps([p.text.strip() for p in Document("/Users/charbelnasr/Downloads/NR Presentation .docx").paragraphs if p.text.strip()]))'],{encoding:'utf8'}));
const chunks=[];
for(const p of paragraphs){if(/^challenge \d:/i.test(p)) chunks.push([p]); else chunks.at(-1).push(p);}
const rows=[];
const mappings=[
  t=>[[t[0],t[1]],...t.slice(2).map((x,k)=>{const i=x.indexOf(':');if(k===0)return [x.slice(0,i).trim(),x.slice(i+1).trim()];const j=x.indexOf('?');return [x.slice(0,j+1),x.slice(j+1).trim()];})],
  t=>Array.from({length:4},(_,i)=>[t[i*2],t[i*2+1]]),
  t=>Array.from({length:4},(_,i)=>[t[i*3],t.slice(i*3+1,i*3+3).join('\n')]),
  t=>[[t[0],''],[t[1],''],['Storytelling technique',t[2]],['First-aid or health-protection skill',t[3]]],
  ()=>[['Executive Committee Strategic Plan','Develop and present a strategic plan outlining how you would contribute to the Lebanese Red Cross Youth Sector as an Executive Committee member.']]
];
for(const [i,c] of chunks.entries()){
  const req=c.indexOf('Requirements');
  const topic=c.findIndex(p=>/^(campaign )?topics:$/i.test(p));
  const description=c.slice(1,req).join('\n');
  const instructions=c.slice(req+1,topic<0?undefined:topic).join('\n');
  const topics=mappings[i](topic<0?[]:c.slice(topic+1));
  for(const [title,desc] of topics)rows.push([c[0],description,instructions,title,desc]);
}
if(chunks.length!==5||rows.length!==17)throw Error('Unexpected source structure');
const seen=new Set();
for(const r of rows){
  if(r.slice(0,4).some(v=>!v))throw Error('Missing required field');
  if(r[0].length>160||r[3].length>160||r[1].length>10000||r[2].length>20000)throw Error('Field limit');
  const key=r[0].toLowerCase()+'|'+r[3].toLowerCase();if(seen.has(key))throw Error('Duplicate topic');seen.add(key);
}
s.getRange(`A2:E${rows.length+1}`).values=rows;
s.getRange(`A2:E${rows.length+1}`).format.wrapText=true;
s.getRange(`A2:E${rows.length+1}`).format.verticalAlignment='top';
for(const [col,width] of [['A',35],['B',65],['C',100],['D',55],['E',80]])s.getRange(`${col}1:${col}18`).format.columnWidth=width;
s.getRange('A2:E18').format.autofitRows();
w.recalculate();
console.log((await w.inspect({kind:'table',range:'Challenges!A1:E3',include:'values,formulas',maxChars:6000,tableMaxRows:3,tableMaxCols:5})).ndjson);
const out=await SpreadsheetFile.exportXlsx(w);await out.save(dir+'NR-Presentation-Challenges.xlsx');
const img=await w.render({sheetName:'Challenges',range:'A1:E3',scale:1,format:'png'});
await fs.writeFile(dir+'filled.png',new Uint8Array(await img.arrayBuffer()));
console.log(JSON.stringify(rows.map(r=>({challenge:r[0],topic:r[3],description:r[4]})),null,2));
