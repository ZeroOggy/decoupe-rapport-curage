pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const drop=document.getElementById('drop'), fileEl=document.getElementById('file');
const progress=document.getElementById('progress'), pfill=document.getElementById('pfill'), pmsg=document.getElementById('pmsg');
const result=document.getElementById('result'), countEl=document.getElementById('count');
const actions=document.getElementById('actions'), listEl=document.getElementById('list'), footer=document.getElementById('footer');

function abbr(rue){
  rue=rue.replace(/^\s*Chemin\b/i,'Ch');
  rue=rue.replace(/^\s*Route\b/i,'Rte');
  rue=rue.replace(/^\s*Avenue\b/i,'Av');
  return rue;
}
function slug(s){return (s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}

function analyse(text){
  const t=text.replace(/\s+/g,' ');let num=null,kind=null,date=null,rue=null,m;
  if(/Informations? g[eé]n[eé]rales?/.test(t)) return {num:null,kind:'skip',date:null,rue:null};
  if(m=t.match(/Inspection de tronçon\s*-\s*(\S+)/)){
    num=m[1];kind='insp';
    const d=t.match(/(\d{2})\.(\d{2})\.(\d{4})/); if(d)date=d[3]+d[2]+d[1];
    const r=t.match(/Rue\s+(.+?)\s+Fonction/); if(r)rue=r[1];
  }else if(m=t.match(/Inclinaison de tronçon\s*-\s*(\S+)/)){num=m[1];kind='incl';}
  else if(m=t.match(/Photos de tronçon\s*-\s*(\S+)/)){num=m[1];kind='photo';}
  return {num,kind,date,rue};
}
function setProgress(pct,msg){progress.classList.add('on');pfill.style.width=pct+'%';if(msg)pmsg.innerHTML=msg;}

drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');
  if(e.dataTransfer.files.length)handle(e.dataTransfer.files[0]);});
fileEl.addEventListener('change',e=>{if(e.target.files.length)handle(e.target.files[0]);});

async function handle(file){
  result.classList.remove('on');listEl.innerHTML='';actions.innerHTML='';footer.textContent='';
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){
    setProgress(0,'<span class="err">Ce fichier n\'est pas un PDF. Glissez un rapport .pdf.</span>');return;
  }
  drop.classList.add('busy');
  setProgress(4,'Lecture de <b>'+file.name+'</b>…');
  const buf=await file.arrayBuffer();

  let doc;
  try{doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;}
  catch(err){drop.classList.remove('busy');setProgress(0,'<span class="err">PDF illisible : '+err.message+'</span>');return;}

  const N=doc.numPages, info=[];
  for(let i=1;i<=N;i++){
    const page=await doc.getPage(i);
    const tc=await page.getTextContent();
    info.push(analyse(tc.items.map(it=>it.str).join(' ')));
    setProgress(Math.round(i/N*55),'Analyse des pages… <b>'+i+'/'+N+'</b>');
  }

  const order=[],groups={},meta={};let current=null;
  info.forEach((pi,idx)=>{
    if(pi.kind==='skip')return;
    if(pi.num===null){if(current!==null)groups[current].push(idx);return;}
    if(pi.num!==current){current=pi.num;if(!groups[pi.num]){groups[pi.num]=[];order.push(pi.num);meta[pi.num]={};}}
    groups[pi.num].push(idx);
    if(pi.date&&!meta[pi.num].date)meta[pi.num].date=pi.date;
    if(pi.rue&&!meta[pi.num].rue)meta[pi.num].rue=pi.rue;
  });

  if(!order.length){drop.classList.remove('busy');
    setProgress(0,'<span class="err">Aucun tronçon détecté. Ce rapport a-t-il bien des pages « Inspection de tronçon - N » ?</span>');return;}

  const src=await PDFLib.PDFDocument.load(buf);
  const zip=new JSZip(),rows=[];

  for(let k=0;k<order.length;k++){
    const num=order[k],m=meta[num];
    const out=await PDFLib.PDFDocument.create();
    const idxs=groups[num];
    (await out.copyPages(src,idxs)).forEach(p=>out.addPage(p));
    const bytes=await out.save();
    const rue=slug(abbr(m.rue||'Rue'));
    const fname=(m.date||'0000')+'_'+rue+'_'+num+'.pdf';
    zip.file(fname,bytes);
    rows.push({fname,num,pages:idxs.map(i=>i+1)});
    setProgress(55+Math.round((k+1)/order.length*40),'Découpe des tronçons… <b>'+(k+1)+'/'+order.length+'</b>');
  }

  const blob=await zip.generateAsync({type:'blob'});
  const url=URL.createObjectURL(blob);
  const zipName=slug(file.name.replace(/\.pdf$/i,''))+'_decoupe.zip';

  drop.classList.remove('busy');
  setProgress(100,'Terminé.');

  countEl.innerHTML='<span>'+order.length+'</span> '+(order.length>1?'tronçons':'tronçon')+' · '+N+' pages';
  actions.innerHTML=
    '<a class="btn dl" href="'+url+'" download="'+zipName+'">'+
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'+
    'Télécharger le ZIP</a>'+
    '<button class="btn ghost" onclick="location.reload()">Autre rapport</button>';

  listEl.innerHTML=rows.map(r=>{
    const pp=r.pages.length>6
      ? 'p.'+r.pages[0]+'–'+r.pages[r.pages.length-1]
      : 'p.'+r.pages.join(', ');
    const dot=r.fname.lastIndexOf('.');
    const nm=r.fname.slice(0,dot), ex=r.fname.slice(dot);
    return '<div class="row"><span class="no">'+r.num+'</span>'+
      '<span class="name">'+nm+'<span class="ext">'+ex+'</span></span>'+
      '<span class="pg">'+pp+'</span></div>';
  }).join('');
  footer.textContent='Détection basée sur les pages « Inspection de tronçon ». Pages de couverture et de légende ignorées.';
  result.classList.add('on');
}
