// Configurer pdf.js seulement si la librairie est chargée (évite de casser
// toute l'UI si un CDN est lent ou bloqué).
if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const dropReport=document.getElementById('dropReport'), fileReport=document.getElementById('fileReport');
const dropPlans=document.getElementById('dropPlans'), filePlans=document.getElementById('filePlans');
const reportList=document.getElementById('reportList'), plansList=document.getElementById('plansList');
const reportHint=document.getElementById('reportHint'), plansHint=document.getElementById('plansHint');
const runBtn=document.getElementById('runBtn'), clearBtn=document.getElementById('clearBtn');
const progress=document.getElementById('progress'), pfill=document.getElementById('pfill'), pmsg=document.getElementById('pmsg');
const result=document.getElementById('result'), countEl=document.getElementById('count');
const actions=document.getElementById('actions'), listEl=document.getElementById('list');
const notice=document.getElementById('notice'), footer=document.getElementById('footer');

// état : fichiers retenus
let reportFile=null;       // un seul rapport
let planFiles=[];          // plusieurs plans

function isPdf(f){return f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf');}

function refreshUI(){
  // rapport
  if(reportFile){
    dropReport.classList.add('filled');
    reportList.innerHTML='<div><span class="x">✓</span>'+reportFile.name+'</div>';
  }else{
    dropReport.classList.remove('filled');
    reportList.innerHTML='';
  }
  // plans
  if(planFiles.length){
    dropPlans.classList.add('filled');
    plansList.innerHTML=planFiles.map(f=>'<div><span class="x">✓</span>'+f.name+'</div>').join('');
  }else{
    dropPlans.classList.remove('filled');
    plansList.innerHTML='';
  }
  runBtn.disabled=!reportFile;
  clearBtn.style.display=(reportFile||planFiles.length)?'inline':'none';
}

function addReport(files){
  const pdfs=[...files].filter(isPdf);
  if(pdfs.length)reportFile=pdfs[0];   // on ne garde qu'un rapport
  refreshUI();
}
function addPlans(files){
  [...files].filter(isPdf).forEach(f=>{
    if(!planFiles.some(p=>p.name===f.name&&p.size===f.size))planFiles.push(f);
  });
  refreshUI();
}

function wireZone(zone,onFiles){
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');
    if(e.dataTransfer.files.length)onFiles(e.dataTransfer.files);});
}
wireZone(dropReport,addReport);
wireZone(dropPlans,addPlans);
fileReport.addEventListener('change',e=>{if(e.target.files.length)addReport(e.target.files);e.target.value='';});
filePlans.addEventListener('change',e=>{if(e.target.files.length)addPlans(e.target.files);e.target.value='';});

clearBtn.addEventListener('click',()=>{reportFile=null;planFiles=[];result.classList.remove('on');
  progress.classList.remove('on');refreshUI();});
runBtn.addEventListener('click',()=>{ if(reportFile)run(); });

function abbr(rue){
  rue=rue.replace(/^\s*Chemin\b/i,'Ch');
  rue=rue.replace(/^\s*Route\b/i,'Rte');
  rue=rue.replace(/^\s*Avenue\b/i,'Av');
  return rue;
}
function slug(s){return (s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}

function normNum(s){           // "01" -> "1", "  2 " -> "2", garde non-numériques tels quels
  if(s==null)return null;
  const m=String(s).match(/\d+/);
  return m ? String(parseInt(m[0],10)) : String(s).trim();
}

function analyse(text){
  const t=text.replace(/\s+/g,' ');let num=null,kind=null,date=null,rue=null,plan=null,m;
  if(/Informations? g[eé]n[eé]rales?/.test(t)) return {num:null,kind:'skip'};
  if(m=t.match(/Inspection de tron[çc]on\s*-\s*([0-9]+)/)){
    num=normNum(m[1]);kind='insp';
    const d=t.match(/(\d{2})\.(\d{2})\.(\d{4})/); if(d)date=d[3]+d[2]+d[1];
    const r=t.match(/Rue\s+(.+?)\s+Fonction/); if(r)rue=r[1];
    const pl=t.match(/Plan N°\s*([0-9]+)/); if(pl)plan=normNum(pl[1]);
  }else if(m=t.match(/Inclinaison de tron[çc]on\s*-\s*([0-9]+)/)){num=normNum(m[1]);kind='incl';}
  else if(m=t.match(/Photos de tron[çc]on\s*-\s*([0-9]+)/)){num=normNum(m[1]);kind='photo';}
  return {num,kind,date,rue,plan};
}

// Décompose un nom de fichier plan -> liste de numéros (gère 74-77 et 175_et_176 et 1-6_10-17)
function planNumbers(fname){
  let base=fname.replace(/\.pdf$/i,'').replace(/^plan[_\s-]*/i,'');
  const nums=new Set();
  let m, re=/(\d+)\s*[-–]\s*(\d+)/g;
  while(m=re.exec(base)){
    const a=+m[1], b=+m[2];
    if(b>=a && b-a<=50){ for(let k=a;k<=b;k++)nums.add(k); }
  }
  (base.match(/\d+/g)||[]).forEach(x=>nums.add(+x));
  return [...nums];
}

function setProgress(pct,msg){progress.classList.add('on');pfill.style.width=pct+'%';if(msg)pmsg.innerHTML=msg;}

async function readPages(buf){
  const doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  const info=[];
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i);
    const tc=await page.getTextContent();
    info.push(analyse(tc.items.map(it=>it.str).join(' ')));
  }
  return info;
}

// Ajoute les pages d'un plan PDF à la fin de `out`.
// 1) tente la copie directe (vectorielle, rapide) ; 2) si le PDF est chiffré
// ou refuse la copie, rend chaque page via pdf.js et l'intègre comme image.
async function appendPlan(out, planBuf){
  // tentative copie directe
  try{
    const pdoc=await PDFLib.PDFDocument.load(planBuf);
    const cp=await out.copyPages(pdoc, pdoc.getPageIndices());
    cp.forEach(p=>out.addPage(p));
    return true;
  }catch(e){ /* probablement chiffré : on passe au rendu image */ }

  // rendu image via pdf.js (gère les PDF chiffrés)
  const doc=await pdfjsLib.getDocument({data:planBuf.slice(0)}).promise;
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i);
    const vp=page.getViewport({scale:2});         // 2x = bonne lisibilité
    const canvas=document.createElement('canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    const ctx=canvas.getContext('2d');
    await page.render({canvasContext:ctx, viewport:vp}).promise;
    const dataUrl=canvas.toDataURL('image/png');
    const png=await out.embedPng(dataUrl);
    const p=out.addPage([vp.width, vp.height]);
    p.drawImage(png,{x:0,y:0,width:vp.width,height:vp.height});
  }
  return true;
}

async function run(){
  if(typeof pdfjsLib==='undefined'||typeof PDFLib==='undefined'||typeof JSZip==='undefined'){
    setProgress(0,'<span class="err">Les composants n\'ont pas pu se charger (connexion internet requise au premier lancement). Vérifiez votre connexion puis rechargez la page.</span>');
    runBtn.disabled=false;return;
  }
  result.classList.remove('on');listEl.innerHTML='';actions.innerHTML='';footer.textContent='';
  notice.classList.remove('on');
  runBtn.disabled=true;
  const reportBuf=await reportFile.arrayBuffer();

  setProgress(3,'Lecture du rapport…');

  // plans : lire chaque buffer + numéros
  const plans=[];
  for(const f of planFiles){
    plans.push({file:f, buf:await f.arrayBuffer(), nums:planNumbers(f.name)});
  }

  // 1) Analyser le rapport
  let info;
  try{ info=await readPages(reportBuf); }
  catch(err){runBtn.disabled=false;setProgress(0,'<span class="err">Rapport illisible : '+err.message+'</span>');return;}
  const N=info.length;
  setProgress(45,'Découpe des tronçons…');

  const order=[],groups={},meta={};let current=null;
  info.forEach((pi,idx)=>{
    if(pi.kind==='skip')return;
    if(pi.num==null){if(current!==null)groups[current].push(idx);return;}
    if(pi.num!==current){current=pi.num;if(!groups[pi.num]){groups[pi.num]=[];order.push(pi.num);meta[pi.num]={};}}
    groups[pi.num].push(idx);
    if(pi.date&&!meta[pi.num].date)meta[pi.num].date=pi.date;
    if(pi.rue&&!meta[pi.num].rue)meta[pi.num].rue=pi.rue;
    if(pi.plan&&!meta[pi.num].plan)meta[pi.num].plan=pi.plan;
  });
  if(!order.length){runBtn.disabled=false;
    setProgress(0,'<span class="err">Aucun tronçon détecté. Ce fichier est-il bien un rapport de curage ?</span>');return;}

  // 2) Index des plans par numéro (un plan peut couvrir plusieurs tronçons)
  const planByNum={};
  plans.forEach(p=>p.nums.forEach(n=>{ const key=String(n); if(!planByNum[key])planByNum[key]=p; }));

  // 3) Construire chaque PDF de tronçon
  const src=await PDFLib.PDFDocument.load(reportBuf,{ignoreEncryption:true});
  const zip=new JSZip(),rows=[];
  const usedPlans=new Set(); const matchedTroncons=new Set();

  for(let k=0;k<order.length;k++){
    const num=order[k],m=meta[num];
    const out=await PDFLib.PDFDocument.create();
    const idxs=groups[num];
    (await out.copyPages(src,idxs)).forEach(p=>out.addPage(p));

    // plan associé : via champ "Plan N°" du rapport, sinon via le n° de tronçon lui-même
    let planUsed=null;
    const k1 = (m.plan!=null) ? String(m.plan) : null;
    const k2 = String(num);
    if(k1 && planByNum[k1]){ planUsed=planByNum[k1]; }
    else if(planByNum[k2]){ planUsed=planByNum[k2]; }

    if(planUsed){
      try{
        await appendPlan(out, planUsed.buf);
        usedPlans.add(planUsed.file.name); matchedTroncons.add(num);
      }catch(e){ console.warn('Plan non intégrable:',planUsed.file.name,e); }
    }

    const bytes=await out.save();
    const rue=slug(abbr(m.rue||'Rue'));
    const fname=(m.date||'0000')+'_'+rue+'_'+num+'.pdf';
    zip.file(fname,bytes);
    rows.push({fname,num,pages:idxs.map(i=>i+1),plan:planUsed?planUsed.file.name:null});
    setProgress(45+Math.round((k+1)/order.length*50),'Assemblage… <b>'+(k+1)+'/'+order.length+'</b>');
  }

  const blob=await zip.generateAsync({type:'blob'});
  const url=URL.createObjectURL(blob);
  const zipName=slug(reportFile.name.replace(/\.pdf$/i,''))+'_decoupe.zip';

  setProgress(100,'Terminé.');

  const nbPlansLies=matchedTroncons.size;
  countEl.innerHTML='<span>'+order.length+'</span> '+(order.length>1?'tronçons':'tronçon')+
    ' · '+N+' pages'+(plans.length?' · '+nbPlansLies+' plan'+(nbPlansLies>1?'s':'')+' liés':'');
  actions.innerHTML=
    '<a class="btn dl" href="'+url+'" download="'+zipName+'">'+
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'+
    'Télécharger le ZIP</a>'+
    '<button class="btn ghost" onclick="location.reload()">Autre rapport</button>';

  listEl.innerHTML=rows.map(r=>{
    const pp=r.pages.length>6?'p.'+r.pages[0]+'–'+r.pages[r.pages.length-1]:'p.'+r.pages.join(', ');
    const dot=r.fname.lastIndexOf('.');
    const nm=r.fname.slice(0,dot), ex=r.fname.slice(dot);
    const chip=r.plan?'<span class="chip plan">+ plan</span>':'';
    return '<div class="row"><span class="no">'+r.num+'</span>'+
      '<span class="name">'+nm+'<span class="ext">'+ex+'</span></span>'+
      '<span class="meta">'+chip+'<span class="pg">'+pp+'</span></span></div>';
  }).join('');

  // Avertissements
  const msgs=[];

  // a) plans déposés mais rattachés à aucun tronçon
  const orphan=plans.filter(p=>!usedPlans.has(p.file.name));
  if(orphan.length){
    msgs.push('<div class="msg warn"><b>'+orphan.length+' plan'+(orphan.length>1?'s non rattachés':' non rattaché')+
      '</b> : '+orphan.map(p=>p.file.name).join(', ')+'. '+
      'Vérifiez que le numéro du plan correspond à un n° de tronçon.</div>');
  }

  // b) tronçons sans plan (seulement si au moins un plan a été fourni)
  if(plans.length){
    const sansPlan=order.filter(n=>!matchedTroncons.has(n));
    if(sansPlan.length){
      const liste=sansPlan.join(', ');
      msgs.push('<div class="msg info"><b>'+sansPlan.length+' tronçon'+(sansPlan.length>1?'s sans plan':' sans plan')+
        '</b> : n° <span class="nums">'+liste+'</span>. '+
        'Aucun plan déposé ne couvre ce'+(sansPlan.length>1?'s numéros':' numéro')+'.</div>');
    }
  }

  if(msgs.length){
    notice.innerHTML=msgs.join('');
    notice.classList.add('on');
  }
  footer.textContent='Liaison des plans par le champ « Plan N° » du rapport (à défaut, par le n° de tronçon). Détection des tronçons par les pages « Inspection ». Pages de couverture, légende et « Informations générales » ignorées.';
  result.classList.add('on');
}
