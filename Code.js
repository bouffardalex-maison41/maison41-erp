/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAISON 41 — ERP OS v3 · Code.gs
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉPLOIEMENT :
 *  1. appsscript.json → runtimeVersion V8 + executeAs USER_DEPLOYING
 *  2. Ce fichier → Code.gs  |  3. Index.html → contenu Index.html
 *  4. Déployer → Nouvelle version → Application Web
 */

// ─── ENTRÉE WEB APP ───────────────────────────────────────────────────────
// ─── HELPER : sérialisation JSON sûre pour injection dans <script> ───────
// JSON.stringify peut produire des U+2028 (LINE SEPARATOR) et U+2029
// (PARAGRAPH SEPARATOR) qui sont valides en JSON mais invalides dans un
// littéral string JS — ils rompent le parsing du <script> entier.
// Cette fonction les échappe, ainsi que </script> (fermeture anticipée du bloc).
function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/<\/script>/gi, '<\\/script>');
}

function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  try {
    try { t.initialAppData  = safeJson(getAllAppData()); }
    catch(e1){ Logger.log('doGet appData error: '+e1.message); t.initialAppData  = 'null'; }

    try { t.initialProdData = safeJson(getProductionData()); }
    catch(e2){ Logger.log('doGet prodData error: '+e2.message); t.initialProdData = 'null'; }

    try {
      var usersAll = readSheet('Utilisateurs');
      var usersPublic = usersAll.map(function(u){
        var o = {};
        Object.keys(u).forEach(function(k){
          if(String(k).trim().toUpperCase() === 'PIN') return;
          var v = u[k];
          if(v !== null && v !== undefined && typeof v === 'object' && !(v instanceof Date)){
            try{ JSON.stringify(v); } catch(ev){ v = ''; }
          }
          o[k] = v;
        });
        return o;
      });
      t.initialUsers = safeJson(usersPublic);
    } catch(e3){ Logger.log('doGet users error: '+e3.message); t.initialUsers = '[]'; }

  } catch(e) {
    Logger.log('doGet inject error: ' + e.message);
    t.initialAppData  = t.initialAppData  || 'null';
    t.initialProdData = t.initialProdData || 'null';
    t.initialUsers    = t.initialUsers    || '[]';
  }
  Logger.log('appData length: ' + t.initialAppData.length);
  return t.evaluate()
    .setTitle('MAISON 41 — ERP OS v3')
    .addMetaTag('viewport','width=device-width,initial-scale=1,maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// ─── UTILITAIRES ──────────────────────────────────────────────────────────
// ⚠️ IMPORTANT : remplacer 'COLLE_TON_ID_SHEETS_ICI' par l'ID réel de ton Google Sheets
// L'ID se trouve dans l'URL : docs.google.com/spreadsheets/d/ ►► ICI ◄◄ /edit
var SPREADSHEET_ID = '1-9AsLcufZFlyRs6CGWRihuSyhgOiXoajqTUpOD2niD0';
function SS(){
  if(SPREADSHEET_ID==='COLLE_TON_ID_SHEETS_ICI'){
    throw new Error('SPREADSHEET_ID non configuré — remplacer la valeur dans Code.gs ligne ~38 (docs.google.com/spreadsheets/d/[ID]/edit)');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name){
  // Essaie le nom exact, puis variantes sans/avec accents
  var ss=SS();
  var alts=[name,
    name.replace(/é/g,'e').replace(/è/g,'e').replace('ê','e').replace(/à/g,'a').replace(/ô/g,'o'),
    name.replace(/e([^aeiou])/gi,'é$1'),
    (name+' ').trim()
  ];
  for(var i=0;i<alts.length;i++){var sh=ss.getSheetByName(alts[i]);if(sh)return sh;}
  // Fallback : cherche par nom partiel (casse insensible)
  var sheets=ss.getSheets();
  var nl=name.toLowerCase().trim();
  for(var i=0;i<sheets.length;i++){if(sheets[i].getName().toLowerCase().trim()===nl)return sheets[i];}
  return null;
}

function readSheet(name){
  var sh=getSheet(name);
  if(!sh){Logger.log('readSheet: feuille introuvable -> '+name);return [];}
  var d=sh.getDataRange().getValues();
  if(d.length<2) return [];
  // Détection robuste de la ligne d'en-tête :
  // On cherche la ligne avec le PLUS de cellules texte distinctes non-vides parmi les 10 premières.
  // Ça évite de se faire piéger par un titre fusionné en ligne 1 (ex. "MAISON 41 — Stock MP").
  var bestIdx=0, bestScore=0;
  for(var i=0;i<Math.min(d.length,10);i++){
    var sc=0,uniq={};
    for(var j=0;j<d[i].length;j++){
      var v=d[i][j];
      if(v!==null&&v!==undefined&&v!==''&&typeof v==='string'&&!(v instanceof Date)){
        var vt=String(v).trim();
        if(vt&&!uniq[vt]){uniq[vt]=1;sc++;}
      }
    }
    // Bonus si la ligne suivante contient des nombres (signe que c'est bien la ligne d'entête)
    if(sc>0&&i+1<d.length){
      for(var j=0;j<d[i+1].length;j++){
        var nv=d[i+1][j];
        if(typeof nv==='number'&&nv!==0){sc+=0.5;break;}
      }
    }
    if(sc>bestScore){bestScore=sc;bestIdx=i;}
  }
  Logger.log('readSheet '+name+' — headerIdx='+bestIdx+' score='+bestScore);
  // Normalise les sauts de ligne internes (ex: "PRIX\nSAISIR ICI" → "PRIX SAISIR ICI")
  var h=d[bestIdx].map(function(x){return String(x).trim().replace(/\n/g,' ');});
  return d.slice(bestIdx+1).map(function(row){
    var o={};
    h.forEach(function(k,i){
      var v=row[i];
      if(v instanceof Date) v=Utilities.formatDate(v,'Europe/Paris','yyyy-MM-dd');
      o[k]=(v===null||v===undefined)?'':v;
    });
    return o;
  });
}

// Lecture spéciale pour la feuille Config (structure clé→valeur sans ligne d'en-tête classique)
function readConfig(){
  var sh=SS().getSheetByName('Config');
  if(!sh) return {};
  var d=sh.getDataRange().getValues();
  var result={};
  for(var i=0;i<d.length;i++){
    var k=d[i][0];var v=d[i][1];
    if(k!==null&&k!==undefined&&k!==''&&typeof k==='string'
       &&v!==null&&v!==undefined&&v!==''){
      result[String(k).trim()]=v;
    }
  }
  return result;
}


// ─── LECTURE PRIX VENTE — structure fixe connue ───────────────────────────
// La feuille "Prix Vente" est incompatible avec readSheet() car son header
// L4 (Gamme | Format Weck | B TO C...) est suivi d'un sous-header L5 (x1 SAISIR | x3-5%...)
// qui gagne sur le score de détection automatique. On lit donc par index de colonne.
// Colonnes (0-indexed): 0=Gamme 1=Format 2=B2C x1 TTC 3=B2C x3 4=B2C x6 5=B2C x20
//   6=Ecom x1 9=Restau x3 HT 12=Epiceries x6 HT
function readPrixVente(){
  var sh=getSheet('Prix Vente');
  if(!sh){Logger.log('readPrixVente: feuille introuvable');return [];}
  var d=sh.getDataRange().getValues();
  var result=[];
  // Données à partir de L8 (index 7) — les 7 premières lignes = titres + headers + vide + 1ère section title
  for(var i=7;i<d.length;i++){
    var row=d[i];
    var gamme=row[0]; var fmt=row[1];
    // Sauter section titles (gamme=texte, format=vide) et lignes vides
    if(!gamme||!fmt||typeof gamme!=='string'||typeof fmt!=='string') continue;
    var g=String(gamme).trim(); var f=String(fmt).trim();
    if(!g||!f) continue;
    var b2c=parseFloat(row[2])||0;
    if(!b2c) continue; // ligne non configurée (prix manquant)
    result.push({
      gamme:g, format:f,
      b2c:b2c,
      b2cx3:parseFloat(row[3])||0,
      b2cx6:parseFloat(row[4])||0,
      b2cx20:parseFloat(row[5])||0,
      ecom:parseFloat(row[6])||0,
      restaurants:parseFloat(row[9])||0,
      epiceries:parseFloat(row[12])||0
    });
  }
  Logger.log('readPrixVente: '+result.length+' tarifs lus');
  return result;
}

// ─── DEBUG : liste toutes les feuilles du Sheets ──────────────────────────
function debugSheetNames(){
  try{
    var ss=SS();
    var sheets=ss.getSheets();
    var names=sheets.map(function(s){return s.getName();});
    Logger.log('Feuilles disponibles: '+JSON.stringify(names));
    // Diagnostic détaillé Stock et MP
    var diag={sheets:names};
    ['Stock','MP Référentiel','MP Referentiel','Recettes','Planning'].forEach(function(n){
      var sh=getSheet(n);
      if(sh){
        var rows=sh.getRange(1,1,Math.min(8,sh.getLastRow()),Math.min(15,sh.getLastColumn())).getValues();
        diag['_rows_'+n]=rows.map(function(r){return r.map(function(v){return v instanceof Date?v.toISOString().split('T')[0]:v;});});
      }else{
        diag['_rows_'+n]='FEUILLE INTROUVABLE';
      }
    });
    return{success:true,diag:diag};
  }catch(e){Logger.log('debugSheetNames: '+e.message);return{success:false,error:e.message};}
}
function firstEmptyRow(sh,col,startRow){
  var maxR=sh.getMaxRows();
  if(startRow>maxR) return startRow;
  var v=sh.getRange(startRow,col,maxR-startRow+1,1).getValues();
  for(var i=0;i<v.length;i++) if(v[i][0]===''||v[i][0]===null||v[i][0]===undefined) return startRow+i;
  return startRow+v.length;
}

function genNumLot(date,idx){
  var d=date instanceof Date?date:new Date(date);
  return 'LOT-'+Utilities.formatDate(d,'Europe/Paris','yyyyMMdd')+'-'+String(idx).padStart(3,'0');
}

// ─── SÉCURITÉ — HACHAGE PIN ───────────────────────────────────────────────
// SHA-256 hex via Utilities.computeDigest (GAS natif, aucune dépendance externe)
function hashPin(pin){
  var raw=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(pin).trim(),
    Utilities.Charset.UTF_8
  );
  return raw.map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2);}).join('');
}

// ─── AUTHENTIFICATION ─────────────────────────────────────────────────────
// MODE TRANSITION : accepte PIN en clair (legacy) OU hachage SHA-256 (nouveau).
// Pour migrer vers SHA-256 : lancer runMigratePins() une seule fois depuis le menu ERP.
// checkLogin(pin) → retourne l'objet utilisateur {Nom, Rôle, ...} ou null si PIN faux.
function checkLogin(pin){
  try{
    if(!pin||String(pin).trim()==='') return null;
    var p=String(pin).trim();
    var h=hashPin(p);
    var users=readSheet('Utilisateurs');
    for(var i=0;i<users.length;i++){
      var u=users[i];
      if(!u['Nom']) continue;
      // Ignorer les comptes désactivés
      var actif=String(u['Actif']||'').trim().toLowerCase();
      if(actif==='non'||actif==='false'||actif==='0') continue;
      var stored=String(u['PIN']||'').trim().replace(/\.0+$/,'');
      if(!stored) continue;
      // Accepte PIN haché SHA-256 (64 car hex) ou PIN en clair (legacy)
      if(stored===h||stored===p) return u;
    }
    return null;
  }catch(e){Logger.log('checkLogin: '+e.message);return null;}
}

// ─── RBAC CÔTÉ SERVEUR ────────────────────────────────────────────────────
// Lever une exception si le rôle appelant n'est pas dans la liste autorisée.
// Usage : _requireRole(callerRole, ['Gérant','Admin'])
function _requireRole(callerRole,allowedRoles){
  var r=String(callerRole||'').trim();
  if(!r) throw new Error('RBAC: rôle non fourni');
  for(var i=0;i<allowedRoles.length;i++) if(allowedRoles[i]===r) return;
  throw new Error('RBAC: rôle "'+r+'" non autorisé pour cette action (requis: '+allowedRoles.join(', ')+')');
}

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────
// Écrit une ligne dans AuditLog (créé si absent).
// user  = { nom, role }  |  action = 'saveLot' etc.  |  detail = JSON string
function _writeAudit(user,action,detail){
  try{
    var ss=SS();
    var shA=ss.getSheetByName('AuditLog');
    if(!shA){
      shA=ss.insertSheet('AuditLog');
      var hdrs=['Horodatage','Utilisateur','Rôle','Action','Détail'];
      shA.getRange(1,1,1,hdrs.length).setValues([hdrs]);
      shA.getRange(1,1,1,hdrs.length).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
      shA.setFrozenRows(1);
    }
    var row=shA.getLastRow()+1;
    shA.getRange(row,1,1,5).setValues([[
      Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd HH:mm:ss'),
      (user&&user.nom)||'système',
      (user&&user.role)||'?',
      action||'',
      typeof detail==='string'?detail:JSON.stringify(detail||{})
    ]]);
  }catch(e){Logger.log('_writeAudit error: '+e.message);}
}

// ─── COCKPIT ──────────────────────────────────────────────────────────────
function getDashboardData(){
  try{
    var ss=SS(),now=new Date(),mois=now.getMonth()+1,annee=now.getFullYear(),r={};
    var shV=ss.getSheetByName('Ventes'),caM=0,nbV=0,caA=0;
    if(shV){var vd=shV.getDataRange().getValues();for(var i=4;i<vd.length;i++){var d=vd[i][0];if(!(d instanceof Date))continue;var n=parseFloat(vd[i][10])||0;if(d.getFullYear()===annee){caA+=n;if(d.getMonth()+1===mois){caM+=n;nbV++;}}}}
    r.caMonth=caM;r.caAnnee=caA;r.nbVentes=nbV;r.panierMoy=nbV>0?caM/nbV:0;
    var shS=ss.getSheetByName('Stock'),mpR=0,bocT=0;
    if(shS){var sd=shS.getDataRange().getValues();for(var i=5;i<Math.min(sd.length,206);i++){if(parseFloat(sd[i][4]||0)<parseFloat(sd[i][5]||0)&&sd[i][0])mpR++;}for(var i=207;i<sd.length;i++)bocT+=parseFloat(sd[i][3]||0);}
    r.mpRuptures=mpR;r.bocauxTotal=bocT;
    var shP=ss.getSheetByName('Planning'),lAuj=0,l7j=0;
    if(shP){var pd=shP.getDataRange().getValues();var auj=new Date();auj.setHours(0,0,0,0);var j7=new Date(auj);j7.setDate(j7.getDate()+7);for(var i=3;i<pd.length;i++){var dd=pd[i][0];if(!(dd instanceof Date))continue;var dc=new Date(dd);dc.setHours(0,0,0,0);if(dc.getTime()===auj.getTime())lAuj++;if(dc>=auj&&dc<=j7)l7j++;}}
    r.lotsAujourdhui=lAuj;r.lots7j=l7j;
    var shD=ss.getSheetByName('DDM'),ddmE=0,ddmP=0;
    if(shD){var dd2=shD.getDataRange().getValues();for(var i=3;i<dd2.length;i++){if(!dd2[i][0])continue;var st=String(dd2[i][6]||'');if(st==='Expire')ddmE++;else if(st==='Proche')ddmP++;}}
    r.ddmExpires=ddmE;r.ddmProches=ddmP;
    var shH=ss.getSheetByName('HACCP'),hNC=0;
    if(shH){var hd=shH.getDataRange().getValues();for(var i=3;i<hd.length;i++)if(String(hd[i][5])==='NC')hNC++;}
    r.haccpNC=hNC;
    var shC=ss.getSheetByName('Charges'),cF=0,cT=0;
    if(shC){var cd=shC.getDataRange().getValues();for(var i=3;i<cd.length;i++){if(!cd[i][0])continue;var e=parseFloat(cd[i][2])||0;cT+=e;if(String(cd[i][1])==='Fixe')cF+=e;}}
    r.chargesFixe=cF;r.chargesTotal=cT;var txV=cT>0?(cT-cF)/cT:0;r.seuilRentabilite=txV<1?cF/(1-txV):0;
    var shRec=ss.getSheetByName('Réclamations')||ss.getSheetByName('Reclamations'),rO=0;
    if(shRec){var rd=shRec.getDataRange().getValues();for(var i=3;i<rd.length;i++){if(!rd[i][2])continue;var rs=String(rd[i][12]||'').toLowerCase();if(rs.indexOf('clot')<0&&rs!=='archive')rO++;}}
    r.reclOuv=rO;r.decisions=getDecisions();
    return r;
  }catch(e){Logger.log('getDashboardData:'+e.message);return{error:e.message};}
}

function getDecisions(){
  var sh=SS().getSheetByName('Assistant Decisions');if(!sh) return [];
  var d=sh.getDataRange().getValues(),res=[];
  for(var i=3;i<Math.min(d.length,11);i++){if(!d[i][0])continue;res.push({categorie:String(d[i][0]),recommandation:String(d[i][1]),impact:String(d[i][2]||''),priorite:String(d[i][3]||'')});}
  return res;
}

// ─── TOUTES LES DONNÉES APP (chargement unique au login) ──────────────────
function getAllAppData(){
  try{
    var r={};
    r.recettes=readSheet('Recettes').filter(function(x){return x['Ref.']||x['Ref'];}).map(function(x){
      return{ref:x['Ref.']||x['Ref'],nom:x['Nom commercial']||x['Nom']||'',gamme:x['Gamme']||'',format:x['Format principal']||x['Format Weck']||'',tempCCP1:parseFloat(x['Temp_CCP1']||x['Temp CCP1'])||115,machines:x['Machines_utilisees']||x['Machines utilisees']||'',statut:x['Statut']||'Actif'};
    });
    r.prixVente=readPrixVente();
    r.mp=(readSheet('MP Référentiel').length?readSheet('MP Référentiel'):readSheet('MP Referentiel')).filter(function(x){return x['Code MP']||x['Code']||x['Ref']||x['Réf'];}).map(function(x){
      return{code:x['Code MP']||x['Code'],nom:x['Designation']||x['Désignation']||x['MP']||'',categorie:x['Categorie']||x['Catégorie']||'',unite:x['Unite']||x['Unité']||'kg',fournisseur:x['Fournisseur']||'',prix:parseFloat(x['Prix EUR/U']||x['Prix EUR']||x['PRIX SAISIR ICI']||x['Prix']||0)};
    });
    r.config=readConfig();
    var shCli=SS().getSheetByName('👤 Clients')||SS().getSheetByName('Clients');
    r.clients=shCli?readSheet(shCli.getName()).filter(function(x){return x['Nom']||x['Prenom']||x['Prénom']||'';}).slice(0,200):[];
    r.utilisateurs=readSheet('Utilisateurs').filter(function(x){return x['Nom'];}).map(function(x){return{nom:x['Nom'],role:x['Role']||x['Rôle']||''};});
    return r;
  }catch(e){Logger.log('getAllAppData:'+e.message);return{error:e.message,recettes:[],prixVente:[],mp:[],config:{},clients:[],utilisateurs:[]};}
}

// ─── PRODUCTION ───────────────────────────────────────────────────────────
function getProductionData(){
  try{
    var r={};
    r.planning=readSheet('Planning').filter(function(x){return x['Date'];}).slice(0,100);
    r.stock=readSheet('Stock').filter(function(x){return x['Code']||x['Code MP']||x['Ref']||x['Référence']||x['Désignation']||x['Designation'];}).slice(0,300);
    r.haccp=readSheet('HACCP').filter(function(x){return x['Date'];}).slice(0,100);
    r.autoclaves=readSheet('Autoclaves').filter(function(x){return x['Date'];}).slice(0,100);
    r.parcMachine=getParcMachine();
    r.planNettoyage=readSheet('Plan Nettoyage').filter(function(x){return x['Zone'];});
    r.ddm=readSheet('DDM').filter(function(x){return x['N Lot']||x['Num Lot'];}).slice(0,100);
    r.assistantProd=readSheet('Assistant Production').filter(function(x){return x['Recette'];}).slice(0,50);
    return r;
  }catch(e){Logger.log('getProductionData:'+e.message);return{error:e.message};}
}

function saveLotProduction(lot){
  try{
    var sh=SS().getSheetByName('Planning');if(!sh) return{success:false,error:'Feuille Planning introuvable'};
    var row=firstEmptyRow(sh,1,4),d=lot.date?new Date(lot.date):new Date();
    // Planning colonnes : 1=Date|2=N Lot(auto)|3=Recette|4=Gamme(auto)|5=Format Weck|6=Autoclave|7=Fraction|8=Cap.max|9=Nb bocaux plan.|10=Nb bocaux reels|15=T coeur(C)|16=Statut|18=Operateur
    sh.getRange(row,1).setValue(d);sh.getRange(row,3).setValue(lot.recette||'');
    sh.getRange(row,5).setValue(lot.format||'');sh.getRange(row,6).setValue(lot.autoclave||'');
    sh.getRange(row,7).setValue(lot.fraction||'Complet');sh.getRange(row,9).setValue(parseInt(lot.bocauxPlan)||0);
    sh.getRange(row,10).setValue(parseInt(lot.bocauxReels)||'');sh.getRange(row,15).setValue(parseFloat(lot.tempCoeur)||'');
    sh.getRange(row,2).setFormula('=IF(A'+row+'="","",IF(C'+row+'="","","LOT-"&TEXT(A'+row+',"YYYYMMDD")&"-"&TEXT(ROW()-3,"000")))');
    sh.getRange(row,4).setFormula('=IFERROR(INDEX(Recettes!C:C,MATCH(C'+row+',Recettes!B:B,0)),"")');
    var numLot=genNumLot(d,row-3);
    if(lot.tempCoeur||lot.tempCCP1Min){saveHACCP({date:Utilities.formatDate(d,'Europe/Paris','yyyy-MM-dd'),type:'CCP1 — Température cœur',description:'Lot '+numLot+' — '+(lot.recette||''),valeur:parseFloat(lot.tempCoeur)||0,limite:parseFloat(lot.tempCCP1Min)||115,action:'',responsable:lot.operateur||''});}
    _writeAudit({nom:lot.operateur||'',role:lot.callerRole||''},'saveLotProduction',{numLot:numLot,recette:lot.recette});
    return{success:true,row:row,numLot:numLot};
  }catch(e){Logger.log('saveLotProduction:'+e.message);return{success:false,error:e.message};}
}

function saveHACCP(record){
  try{
    var sh=SS().getSheetByName('HACCP');if(!sh) return{success:false};
    var row=firstEmptyRow(sh,1,4),d=record.date?new Date(record.date):new Date();
    sh.getRange(row,1,1,10).setValues([[d,record.type||'',record.description||'',parseFloat(record.valeur)||'',parseFloat(record.limite)||'','',record.action||'',record.responsable||'',record.dateCloture?new Date(record.dateCloture):'',record.notes||'']]);
    // FIX #1 : Temp → NC si sous limite ; pH/contamination → NC si au-dessus
    sh.getRange(row,6).setFormula('=IF(D'+row+'="","",IF(ISNUMBER(SEARCH("temp",LOWER(B'+row+'))),IF(D'+row+'<E'+row+',"NC","OK"),IF(D'+row+'>E'+row+',"NC","OK")))');
    return{success:true,row:row};
  }catch(e){Logger.log('saveHACCP:'+e.message);return{success:false,error:e.message};}
}

function saveAutoclave(record){
  try{
    var sh=SS().getSheetByName('Autoclaves');if(!sh) return{success:false};
    var row=firstEmptyRow(sh,1,4),d=record.date?new Date(record.date):new Date();
    sh.getRange(row,1,1,11).setValues([[d,record.autoclave||'',record.numLot||'',record.recette||'',record.format||'',parseInt(record.nbBocaux)||0,parseFloat(record.tempMax)||0,parseInt(record.duree)||0,'','',record.notes||'']]);
    sh.getRange(row,9).setFormula('=IFERROR(H'+row+'*INDEX(Config!B:B,MATCH("Cout energie par lot (EUR)",Config!A:A,0))/60,"")');
    sh.getRange(row,10).setFormula('=IF(G'+row+'="","",IF(G'+row+'>=INDEX(Config!B:B,MATCH("Autoclave temperature minimale (C)",Config!A:A,0)),"OK","Sous-temperature"))');
    return{success:true,row:row};
  }catch(e){return{success:false,error:e.message};}
}

function updateStockMP(codeMP,newStock){
  try{
    var sh=getSheet('Stock');if(!sh) return{success:false,error:'Feuille Stock introuvable'};
    var d=sh.getRange(5,1,Math.min(sh.getMaxRows()-4,250),10).getValues();
    for(var i=0;i<d.length;i++){if(String(d[i][0])===String(codeMP)){sh.getRange(i+5,5).setValue(parseFloat(newStock)||0);sh.getRange(i+5,7).setFormula('=IF(E'+(i+5)+'="","",IF(E'+(i+5)+'<F'+(i+5)+',"Rupture","OK"))');return{success:true};}}
    return{success:false,error:'Code MP non trouvé: '+codeMP};
  }catch(e){return{success:false,error:e.message};}
}

function updateMPPrix(codeMP,newPrix){
  try{
    var sh=getSheet('MP Référentiel')||getSheet('MP Referentiel');if(!sh) return{success:false,error:'Feuille MP introuvable'};
    var d=sh.getRange(5,1,Math.min(sh.getMaxRows()-4,120),12).getValues();
    for(var i=0;i<d.length;i++){if(String(d[i][0])===String(codeMP)){var ri=i+5;sh.getRange(ri,11).setValue(d[i][5]);sh.getRange(ri,6).setValue(parseFloat(newPrix));sh.getRange(ri,7).setValue(Utilities.formatDate(new Date(),'Europe/Paris','MMM yyyy'));return{success:true};}}
    return{success:false,error:'Code MP non trouvé'};
  }catch(e){return{success:false,error:e.message};}
}

function saveNewMP(mp){
  try{
    var sh=getSheet('MP Référentiel')||getSheet('MP Referentiel');if(!sh) return{success:false,error:'Feuille MP introuvable'};
    var row=firstEmptyRow(sh,1,5);
    sh.getRange(row,1,1,7).setValues([[mp.code||'',mp.nom||'',mp.categorie||'',mp.unite||'kg',mp.fournisseur||'',parseFloat(mp.prix)||0,Utilities.formatDate(new Date(),'Europe/Paris','MMM yyyy')]]);
    return{success:true,row:row};
  }catch(e){return{success:false,error:e.message};}
}

// ─── VENTES ───────────────────────────────────────────────────────────────
function getVentesData(){
  try{
    var r={};
    r.ventes=readSheet('Ventes').filter(function(x){return x['Date'];}).slice(-80).reverse();
    r.marches=readSheet('Marches').filter(function(x){return x['Date marche']||x['Date'];}).slice(0,50);
    r.bonsCommande=readSheet('Bons de Commande').filter(function(x){return x['N° BC']||x['Num BC'];}).slice(0,50);
    return r;
  }catch(e){Logger.log('getVentesData:'+e.message);return{error:e.message};}
}

function saveVente(vente,callerRole){
  try{
    var sh=SS().getSheetByName('Ventes');if(!sh) return{success:false,error:'Feuille Ventes introuvable'};
    var row=firstEmptyRow(sh,1,5),d=vente.date?new Date(vente.date):new Date();
    var qte=parseFloat(vente.qte)||0,puHT=parseFloat(vente.puHT)||0,remise=parseFloat(vente.remise)||0;
    var netHT=qte*puHT*(1-remise/100);
    var numFact=vente.numFacture||('F-'+Utilities.formatDate(d,'Europe/Paris','yyyyMMdd')+'-'+String(row).padStart(3,'0'));
    sh.getRange(row,1,1,14).setValues([[d,numFact,vente.canal||'Direct',vente.client||'',vente.recette||'','',vente.format||'',qte,puHT,remise,netHT,'','',vente.notes||'']]);
    sh.getRange(row,6).setFormula('=IFERROR(INDEX(Recettes!C:C,MATCH(E'+row+',Recettes!B:B,0)),"")');
    // FIX #5 : SUBSTITUTE pour diacritiques (ex: Pâtés → Pates) dans la clé Config "TVA Gamme"
    sh.getRange(row,12).setFormula('=IFERROR(K'+row+'*(INDEX(Config!B:B,MATCH("TVA "&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(F'+row+',"â","a"),"é","e"),"è","e"),"î","i"),SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(Config!A:A,"â","a"),"é","e"),"è","e"),"î","i"),0))-1),"")');
    sh.getRange(row,13).setFormula('=IFERROR(K'+row+'+L'+row+',"")');
    // TVA : lire depuis Config selon gamme, fallback 5.5%
    var cfg=readConfig();
    var gamme=vente.gamme||'';
    var tvaKey='TVA '+gamme+' (%)';
    var tva=parseFloat(cfg[tvaKey])||5.5;
    saveComptaEntry({date:Utilities.formatDate(d,'Europe/Paris','yyyy-MM-dd'),type:'Encaissement',categorie:'Ventes — '+(vente.canal||'Direct'),description:(vente.recette||'')+' × '+qte+' — '+(vente.client||'Client direct'),montant:netHT,tva:tva,mode:vente.modePaiement||'Espèces',ref:numFact});
    _writeAudit({nom:vente.operateur||'',role:callerRole||''},'saveVente',{numFact:numFact,client:vente.client,montantHT:netHT});
    return{success:true,row:row,netHT:netHT,numFacture:numFact};
  }catch(e){Logger.log('saveVente:'+e.message);return{success:false,error:e.message};}
}

function saveMarche(marche){
  try{
    var sh=SS().getSheetByName('Marches');if(!sh) return{success:false,error:'Feuille Marches introuvable'};
    var row=firstEmptyRow(sh,1,4),d=marche.date?new Date(marche.date):new Date();
    sh.getRange(row,1,1,8).setValues([[d,marche.lieu||'',marche.meteo||'',parseFloat(marche.prevision)||0,'','','',marche.notes||'']]);
    sh.getRange(row,5).setFormula('=SUMPRODUCT((TEXT(Ventes!A$5:A$5000,"yyyy-mm-dd")=TEXT(A'+row+',"yyyy-mm-dd"))*(Ventes!C$5:C$5000="Marchés")*Ventes!K$5:K$5000)');
    sh.getRange(row,6).setFormula('=IF(E'+row+'>0,E'+row+'-D'+row+',"")');
    sh.getRange(row,7).setFormula('=IF(E'+row+'>0,TEXT((E'+row+'-D'+row+')/E'+row+',"0%"),"")');
    return{success:true,row:row};
  }catch(e){Logger.log('saveMarche:'+e.message);return{success:false,error:e.message};}
}

function saveClient(client){
  try{
    var sh=SS().getSheetByName('👤 Clients')||SS().getSheetByName('Clients');if(!sh) return{success:false,error:'Feuille Clients introuvable'};
    var row=firstEmptyRow(sh,1,3);
    var id='CLI-'+Utilities.formatDate(new Date(),'Europe/Paris','yyyyMMdd')+'-'+String(row).padStart(3,'0');
    sh.getRange(row,1,1,14).setValues([[id,client.prenom||'',client.nom||'',client.email||'',client.telephone||'',client.adresse||'',client.departement||'',client.canal||'',client.statutUlule||'Non-membre',client.voteRecette||'','','',client.type||'B2C Particulier',client.notes||'']]);
    sh.getRange(row,11).setFormula('=COUNTIF(Ventes!D:D,C'+row+'&" "&B'+row+')');
    sh.getRange(row,12).setFormula('=SUMIF(Ventes!D:D,C'+row+'&" "&B'+row+',Ventes!K:K)');
    return{success:true,row:row,id:id};
  }catch(e){Logger.log('saveClient:'+e.message);return{success:false,error:e.message};}
}

function saveBC(bc){
  try{
    // STRUCTURE RÉELLE "Bons de Commande" 26 colonnes (vérifiée sur le Sheets) :
    // 1=N°BC(formule auto) | 2=Date | 3=Client | 4=Type client | 5=Adresse livraison
    // 6=Recette 1 | 7=Format 1 | 8=Qte 1 | 9=PU HT 1
    // 10=Recette 2 | 11=Format 2 | 12=Qte 2 | 13=PU HT 2
    // 14=Recette 3 | 15=Format 3 | 16=Qte 3 | 17=PU HT 3
    // 18=Remise % | 19=Franco port | 20=Total HT EUR | 21=TVA EUR | 22=TTC EUR
    // 23=Statut | 24=Date livraison | 25=Délai paiement | 26=Notes conditions
    var sh=SS().getSheetByName('Bons de Commande');
    if(!sh) return{success:false,error:'Feuille Bons de Commande introuvable'};
    // Cherche première ligne vide dans col C (Client) à partir de la ligne 5
    var row=firstEmptyRow(sh,3,5);
    var d=bc.date?new Date(bc.date):new Date();
    var lignes=bc.lignes||[];
    var remise=parseFloat(bc.remise||0);
    var totHT=lignes.reduce(function(s,l){return s+(parseFloat(l.qte)||0)*(parseFloat(l.puHT)||0);},0);
    var totHTnet=totHT*(1-remise/100);
    var tva=5.5;
    var totTVA=totHTnet*(tva/100);
    var totTTC=totHTnet*(1+tva/100);
    // Col 1 : formule N° BC auto (identique au template Sheets)
    sh.getRange(row,1).setFormula('=IF(C'+row+'="","","BC-"&TEXT(YEAR(B'+row+'),"0000")&"-"&TEXT(ROW()-4,"000"))');
    // Cols 2-5 : infos générales
    sh.getRange(row,2).setValue(d);
    sh.getRange(row,3).setValue(bc.client||'');
    sh.getRange(row,4).setValue(bc.canal||'B2B');
    sh.getRange(row,5).setValue(bc.notes||''); // Adresse / notes livraison
    // Cols 6-17 : jusqu'à 3 lignes de recettes
    for(var i=0;i<Math.min(lignes.length,3);i++){
      var col=6+(i*4);
      sh.getRange(row,col).setValue(lignes[i].recette||lignes[i].nom||'');
      sh.getRange(row,col+1).setValue(lignes[i].format||'');
      sh.getRange(row,col+2).setValue(parseInt(lignes[i].qte)||1);
      sh.getRange(row,col+3).setValue(parseFloat(lignes[i].puHT)||0);
    }
    // Col 18 : Remise %
    sh.getRange(row,18).setValue(remise);
    // Cols 20-22 : Totaux calculés
    sh.getRange(row,20).setValue(totHTnet);
    sh.getRange(row,21).setValue(totTVA);
    sh.getRange(row,22).setValue(totTTC);
    // Col 23 : Statut
    sh.getRange(row,23).setValue('En attente');
    // Col 24 : Date livraison souhaitée
    if(bc.dateLivraison) sh.getRange(row,24).setValue(new Date(bc.dateLivraison));
    // Col 26 : Notes conditions
    sh.getRange(row,26).setValue(bc.notesConditions||'');
    // Reconstruit le numéro pour le retour (la formule s'appliquera à la prochaine ouverture)
    var num='BC-'+Utilities.formatDate(d,'Europe/Paris','yyyy')+'-'+String(row-4).padStart(3,'0');
    return{success:true,row:row,numBC:num,totalHT:totHTnet,totalTTC:totTTC};
  }catch(e){Logger.log('saveBC:'+e.message);return{success:false,error:e.message};}
}

// ─── RÉCLAMATIONS ─────────────────────────────────────────────────────────
function saveReclamation(rec){
  try{
    var sh=SS().getSheetByName('Réclamations')||SS().getSheetByName('Reclamations');if(!sh) return{success:false};
    var row=firstEmptyRow(sh,3,4),d=rec.date?new Date(rec.date):new Date();
    sh.getRange(row,1,1,14).setValues([['',d,rec.client||'',rec.contact||'',rec.numLot||'',rec.recette||'',rec.nature||'',rec.gravite||'Mineur',rec.description||'',rec.action||'','',rec.dateReponse?new Date(rec.dateReponse):'',rec.statut||'Ouvert','']]);
    sh.getRange(row,1).setFormula('=IF(C'+row+'="","","REC-"&TEXT(YEAR(B'+row+'),"0000")&"-"&TEXT(ROW()-3,"000"))');
    sh.getRange(row,11).setFormula('=IFERROR(IF(B'+row+'="","",IF(H'+row+'="Critique (danger santé)",B'+row+'+1,B'+row+'+5)),"")');
    return{success:true,row:row};
  }catch(e){Logger.log('saveReclamation:'+e.message);return{success:false,error:e.message};}
}

// ─── COMPTABILITÉ ─────────────────────────────────────────────────────────
function saveComptaEntry(entry){
  try{
    var sh=SS().getSheetByName('Compta');if(!sh) return{success:false};
    var row=firstEmptyRow(sh,1,4),d=entry.date?new Date(entry.date):new Date();
    var mt=parseFloat(entry.montant)||0,tva=parseFloat(entry.tva)||0;
    var tvaEUR=mt*tva/100, netTTC=mt+tvaEUR;
    // FIX #4 : 10 colonnes = Date | Type | Catégorie | Description | Montant HT | TVA % | TVA EUR | TTC | Mode | Réf
    sh.getRange(row,1,1,10).setValues([[d,entry.type||'Encaissement',entry.categorie||'',entry.description||'',mt,tva,tvaEUR,netTTC,entry.mode||'Espèces',entry.ref||'']]);
    return{success:true,row:row};
  }catch(e){Logger.log('saveComptaEntry:'+e.message);return{success:false,error:e.message};}
}

// ─── ACHATS MP ─────────────────────────────────────────────────────────────
// FIX #8 : API Achats exposant feuilles Achats + Prévision Stock
function getAchatsData(){
  try{
    var r={};
    r.achats=readSheet('Achats').filter(function(x){return x['Date']||x['Fournisseur'];}).slice(0,100);
    r.previsionStock=readSheet('Prévision Stock').filter(function(x){return x['Code MP']||x['Code'];}).slice(0,200);
    // Calcul recommandations de commande : stock actuel < seuil x 1.5
    var shS=getSheet('Stock');
    var recommandations=[];
    if(shS){
      var sd=shS.getRange(5,1,Math.min(shS.getMaxRows()-4,250),8).getValues();
      sd.forEach(function(row){
        if(!row[0]) return;
        var stockAct=parseFloat(row[4])||0;
        var seuilAl=parseFloat(row[5])||0;
        var conso7j=parseFloat(row[6])||0;
        if(seuilAl>0&&stockAct<seuilAl*1.5){
          var joursRestants=conso7j>0?Math.round(stockAct/conso7j*7):null;
          recommandations.push({
            code:String(row[0]),designation:String(row[1]||''),
            stockActuel:stockAct,seuilAlerte:seuilAl,
            conso7j:conso7j,joursRestants:joursRestants,
            urgence:stockAct<seuilAl?'Rupture':'Bientot'
          });
        }
      });
    }
    r.recommandations=recommandations;
    return r;
  }catch(e){Logger.log('getAchatsData:'+e.message);return{error:e.message,achats:[],previsionStock:[],recommandations:[]};}
}

// ─── FINANCE ──────────────────────────────────────────────────────────────
function getFinanceData(){
  try{
    var r={};
    r.coutRevient=readSheet('Cout de Revient').filter(function(x){return x['Recette'];});
    r.analyseMarge=readSheet('Analyse Marges').filter(function(x){return x['Canal'];});
    r.previsionnel=readSheet('Previsionnel').filter(function(x){return x['Mois'];});
    r.charges=readSheet('Charges').filter(function(x){return x['Poste'];});
    r.pilotage=readSheet('Pilotage Financier').filter(function(x){return x['Indicateur'];});
    r.compta=readSheet('Compta').filter(function(x){return x['Date'];}).slice(-60).reverse();
    return r;
  }catch(e){Logger.log('getFinanceData:'+e.message);return{error:e.message};}
}

function saveCharge(charge){
  try{
    var sh=SS().getSheetByName('Charges');if(!sh) return{success:false};
    var row=firstEmptyRow(sh,1,4);
    // FIX #2 : grille réelle = Poste(1) | Type(2) | Estimation(3) | Jan(4)..Déc(15) | Total(16)
    var moisMap={Jan:4,Fev:5,Mar:6,Avr:7,Mai:8,Juin:9,Juil:10,Aout:11,Sep:12,Oct:13,Nov:14,'Déc':15,'Dec':15};
    var colMois=moisMap[charge.mois||'']||0;
    sh.getRange(row,1).setValue(charge.poste||'');
    sh.getRange(row,2).setValue(charge.type||'Fixe');
    sh.getRange(row,3).setValue(parseFloat(charge.montantEstime)||0);
    if(colMois>0) sh.getRange(row,colMois).setValue(parseFloat(charge.montantReel)||0);
    return{success:true,row:row};
  }catch(e){return{success:false,error:e.message};}
}

// ─── QUALITÉ ──────────────────────────────────────────────────────────────
function getQualiteData(){
  try{
    var r={};
    r.haccp=readSheet('HACCP').filter(function(x){return x['Date'];}).slice(0,100);
    r.planNettoyage=readSheet('Plan Nettoyage').filter(function(x){return x['Zone'];});
    var shR=SS().getSheetByName('Réclamations')||SS().getSheetByName('Reclamations');
    r.reclamations=shR?readSheet(shR.getName()).filter(function(x){return x['Date recept.']||x['Date'];}).slice(0,50):[];
    r.fichesTech=readSheet('Fiches Techniques').filter(function(x){return x['Ref.']||x['Ref'];});
    r.duerp=readSheet('DUERP').filter(function(x){return x['Risque identifie']||x['Risque identifié']||x['Risque'];});
    r.ddm=readSheet('DDM').filter(function(x){return x['N Lot']||x['Num Lot'];}).slice(0,100);
    r.pms=readSheet('PMS').filter(function(x){return x['Section']||x['Rubrique'];});
    return r;
  }catch(e){Logger.log('getQualiteData:'+e.message);return{error:e.message};}
}

function updateVisa(zone,semaine,visa){
  try{
    var sh=SS().getSheetByName('Plan Nettoyage');if(!sh) return{success:false};
    var d=sh.getDataRange().getValues(),cols={Sem1:7,Sem2:8,Sem3:9,Sem4:10},col=cols[semaine];
    if(!col) return{success:false,error:'Semaine invalide'};
    for(var i=4;i<d.length;i++){if(String(d[i][0])===String(zone)){sh.getRange(i+1,col).setValue(visa);return{success:true};}}
    return{success:false,error:'Zone non trouvée'};
  }catch(e){return{success:false,error:e.message};}
}

// ─── DÉTAIL INGRÉDIENTS D'UNE RECETTE ─────────────────────────────────────
function getIngredientsForRecette(ref){
  try{
    return readSheet('Detail Recettes').filter(function(x){
      // 'Ref. recette' = nom réel de la colonne dans le fichier Excel
      return String(x['Ref. recette']||x['Ref recette']||x['Ref.']||x['Ref'])===String(ref);
    }).map(function(x){
      return{
        code:x['Code MP']||'',
        // 'Designation MP' = nom réel de la colonne dans le fichier Excel
        nom:x['Designation MP']||x['Designation']||x['Désignation']||x['MP']||'',
        cat:x['Categorie']||x['Catégorie']||'',
        // 'Qte par batch' = nom réel de la colonne dans le fichier Excel
        qte:parseFloat(x['Qte par batch']||x['Qte']||x['Quantite']||x['Quantité']||0),
        unite:x['Unite']||x['Unité']||'kg',
        // 'Prix MP (EUR)' = nom réel de la colonne dans le fichier Excel
        prix:parseFloat(x['Prix MP (EUR)']||x['Prix EUR/U']||x['Prix EUR/Unite']||x['Prix']||0)
      };
    });
  }catch(e){Logger.log('getIngredientsForRecette:'+e.message);return[];}
}

// ─── RÉFÉRENTIELS ─────────────────────────────────────────────────────────
function getReferentiels(){
  try{
    return{
      mp:readSheet('MP Referentiel').filter(function(x){return x['Code MP']||x['Code'];}),
      recettes:readSheet('Recettes').filter(function(x){return x['Ref.']||x['Ref'];}),
      config:readConfig(),
      gamme:readSheet('Referentiel Gamme').filter(function(x){return x['Code'];}),
      utilisateurs:readSheet('Utilisateurs').filter(function(x){return x['Nom'];})
    };
  }catch(e){return{error:e.message};}
}

// ─── RECETTES CRUD COMPLET ────────────────────────────────────────────────
function getAllRecettes(){
  try{
    // FIX: cache des feuilles en dehors du .map() — évite O(n) appels readSheet() par recette
    var allDetailRecettes=readSheet('Detail Recettes');
    var allFichesTech=readSheet('Fiches Techniques');
    var allPrixVente=readSheet('Prix Vente');
    return readSheet('Recettes').filter(function(x){return x['Ref.']||x['Ref'];}).map(function(r){
      var ref=r['Ref.']||r['Ref'];
      // Detail Recettes : colonnes réelles = 'Ref. recette', 'Designation MP', 'Qte par batch', 'Prix MP (EUR)'
      var ingrs=allDetailRecettes.filter(function(x){return String(x['Ref. recette']||x['Ref recette']||x['Ref.']||x['Ref'])===String(ref);}).map(function(x){
        return{code:x['Code MP']||'',nom:x['Designation MP']||x['Designation']||x['Désignation']||x['MP']||'',cat:x['Categorie']||x['Catégorie']||'',qte:parseFloat(x['Qte par batch']||x['Qte']||x['Quantite']||0),unite:x['Unite']||x['Unité']||'kg',prix:parseFloat(x['Prix MP (EUR)']||x['Prix EUR/U']||x['Prix']||0)};
      });
      // Fiches Techniques : colonnes réelles = 'Ref.', 'Produit', 'kcal/100g', 'Proteines g', 'Lipides g', 'Glucides g', 'Sel g', 'DDM mois'
      var ft=allFichesTech.find(function(x){return String(x['Ref.']||x['Ref'])===String(ref);})||{};
      // Prix Vente : filtre par gamme (pas par ref), colonnes = 'B TO C MARCHES (TTC)', 'RESTAURANTS (HT)', 'EPICERIES FINES (HT)'
      var pvRows=allPrixVente.filter(function(x){return x['Gamme']&&String(x['Gamme'])===String(r['Gamme']||'');});
      return{
        ref:ref,nom:r['Nom commercial']||r['Nom']||'',gamme:r['Gamme']||'',statut:r['Statut']||'Actif',
        // Recettes : 'Format principal' est la colonne réelle (pas 'Format Weck')
        formatPrincipal:r['Format principal']||r['Format Weck']||'',formats:r['Formats disponibles']||r['Format principal']||'',
        // 'Temp_CCP1' non présent dans ce fichier → utiliser valeur Config par défaut
        tempCCP1:115,
        // 'DDM mois' dans Fiches Techniques, pas dans Recettes
        ddm:parseInt(ft['DDM mois']||r['DDM mois']||r['DDM'])||24,
        ph:parseFloat(r['pH'])||null,aw:parseFloat(r['Aw'])||null,
        rendement:parseFloat(r['Rendement %']||r['Rendement'])||null,
        poidsBrut:parseFloat(r['Batch kg MP']||r['Poids brut'])||null,
        description:r['Description']||'',
        machines:[],allergens:[],traces:'',ingredients:ingrs,
        // Fiches Techniques : 'kcal/100g', 'Proteines g', 'Lipides g', 'Glucides g', 'Sel g'
        nutri:{kj:parseFloat(ft['kJ'])||0,kcal:parseFloat(ft['kcal/100g']||ft['kcal'])||0,graisses:parseFloat(ft['Lipides g']||ft['Graisses'])||0,satures:0,glucides:parseFloat(ft['Glucides g']||ft['Glucides'])||0,sucres:0,proteines:parseFloat(ft['Proteines g']||ft['Protéines g']||ft['Proteines'])||0,fibres:0,sel:parseFloat(ft['Sel g']||ft['Sel'])||0,source:'Ciqual ANSES'},
        prix:pvRows.map(function(p){return{format:p['Format Weck']||p['Format']||'',b2c:parseFloat(p['B TO C MARCHES (TTC)']||p['PVC conseille']||p['B2C']||0),epiceries:parseFloat(p['EPICERIES FINES (HT)']||p['Epiceries']||0),restaurants:parseFloat(p['RESTAURANTS (HT)']||p['Restaurants']||0),b2b:parseFloat(p['B2B']||0)};}),
        dateCreation:r['Date creation']||r['Date création']||'',dateMaj:r['Date maj']||r['Dernière MAJ']||''
      };
    });
  }catch(e){Logger.log('getAllRecettes:'+e.message);return[];}
}

function saveRecette(recette){
  try{
    var sh=SS().getSheetByName('Recettes');if(!sh) return{success:false,error:'Feuille Recettes introuvable'};
    var now=Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd');
    var row=firstEmptyRow(sh,1,4); // données commencent ligne 4 dans Recettes
    // Colonnes réelles (23) : Ref. | Nom commercial | Gamme | Format principal | Rendement % | Batch kg MP | Temps (h) | Statut | Nb ing. | Cout MP/kg | Date creation | Gluten | Oeufs | Lait | Sulfites | Moutarde | Autres allerg. | kcal/100g | Prot. | Lip. | Gluc. | Sel | Sync App
    sh.getRange(row,1,1,11).setValues([[recette.ref||'',recette.nom||'',recette.gamme||'',recette.formatPrincipal||'',parseFloat(recette.rendement)||'',parseFloat(recette.poidsBrut)||'','',recette.statut||'Actif','','',now]]);
    _saveDetailRecette(recette.ref,recette.ingredients||[]);
    // FIX #10 : passer tempCCP1, ddm, allergens à _saveFicheTech
    _saveFicheTech(recette.ref,recette.nom,recette.nutri||{},{tempCCP1:recette.tempCCP1||115,ddm:recette.ddm||24,allergens:recette.allergens||'',traces:recette.traces||''});
    return{success:true,row:row};
  }catch(e){Logger.log('saveRecette:'+e.message);return{success:false,error:e.message};}
}

function updateRecette(recette){
  try{
    var sh=SS().getSheetByName('Recettes');if(!sh) return{success:false,error:'Feuille Recettes introuvable'};
    var d=sh.getDataRange().getValues();
    // En-tête à la ligne 3 (index 2), données à partir de l'index 3
    for(var i=3;i<d.length;i++){
      if(String(d[i][0]).trim()===String(recette.ref||'').trim()){
        sh.getRange(i+1,2,1,4).setValues([[recette.nom||'',recette.gamme||'',recette.formatPrincipal||'',parseFloat(recette.rendement)||'']]);
        sh.getRange(i+1,8).setValue(recette.statut||'Actif');
        _saveDetailRecette(recette.ref,recette.ingredients||[]);
        // FIX #10 : passer tempCCP1, ddm, allergens
        _saveFicheTech(recette.ref,recette.nom,recette.nutri||{},{tempCCP1:recette.tempCCP1||115,ddm:recette.ddm||24,allergens:recette.allergens||'',traces:recette.traces||''});
        return{success:true};
      }
    }
    return{success:false,error:'Recette '+recette.ref+' non trouvée'};
  }catch(e){Logger.log('updateRecette:'+e.message);return{success:false,error:e.message};}
}

function _saveDetailRecette(ref,ingredients){
  try{
    var sh=SS().getSheetByName('Detail Recettes');if(!sh) return;
    // FIX #3 : si liste vide, préserver l'existant (évite suppression accidentelle)
    if(!ingredients||!ingredients.length){
      Logger.log('_saveDetailRecette: liste vide pour '+ref+' — existant conservé');
      return;
    }
    var d=sh.getDataRange().getValues();
    // En-tête à la ligne 4 (index 3), données à partir de l'index 4
    for(var i=d.length-1;i>=4;i--) if(String(d[i][0])===String(ref)) sh.deleteRow(i+1);
    var row=firstEmptyRow(sh,1,5); // données commencent ligne 5
    // Colonnes : Ref. recette | Code MP | Designation MP | Qte par batch | Unite | Prix MP (EUR) | Cout ligne | % cout
    ingredients.forEach(function(ing,idx){
      sh.getRange(row+idx,1,1,5).setValues([[ref,ing.code||'',ing.nom||'',parseFloat(ing.qte)||0,ing.unite||'kg']]);
    });
  }catch(e){Logger.log('_saveDetailRecette:'+e.message);}
}

function _saveFicheTech(ref,nom,nutri,recetteData){
  // FIX #11 : ne pas écraser les allergènes avec 0 ; écrire DDM et tempCCP1
  try{
    var sh=SS().getSheetByName('Fiches Techniques');if(!sh) return;
    var d=sh.getDataRange().getValues(),target=-1;
    for(var i=4;i<d.length;i++) if(String(d[i][0])===String(ref)){target=i+1;break;}
    if(target<0) target=firstEmptyRow(sh,1,5);
    // Colonnes : Ref.|Produit|Gluten|Crustaces|Oeufs|Poissons|Arachides|Lait|Fruits|Celeri|Moutarde|Sesame|Sulfites|Lupin|Mollusques|Traces|kcal|Prot|Lip|Gluc|Sel|Bareme steril.|DDM mois|N° agrement
    sh.getRange(target,1,1,2).setValues([[ref,nom]]);
    // Allergènes (cols 3-16) — seulement si on a des données
    var rd=recetteData||{};
    if(rd.allergens!==undefined&&rd.allergens!==null){
      var algCodes=['gluten','crustace','oeuf','poisson','arachide','lait','fruit','celeri','moutarde','sesame','sulfite','lupin','mollusque'];
      var algStr=String(rd.allergens).toLowerCase();
      var algVals=algCodes.map(function(c){return algStr.includes(c)?1:0;});
      sh.getRange(target,3,1,13).setValues([algVals]);
      sh.getRange(target,16).setValue(rd.traces||'');
    }
    // Valeurs nutritionnelles (cols 17-21)
    sh.getRange(target,17,1,5).setValues([[
      parseFloat(nutri.kcal)||0,
      parseFloat(nutri.proteines)||0,
      parseFloat(nutri.graisses)||0,
      parseFloat(nutri.glucides)||0,
      parseFloat(nutri.sel)||0
    ]]);
    // Barème stérilisation (col 22) et DDM mois (col 23)
    if(rd.tempCCP1) sh.getRange(target,22).setValue(parseFloat(rd.tempCCP1)||115);
    if(rd.ddm) sh.getRange(target,23).setValue(parseInt(rd.ddm)||24);
  }catch(e){Logger.log('_saveFicheTech:'+e.message);}
}

// ─── UTILISATEURS ─────────────────────────────────────────────────────────
function saveUtilisateurs(users){
  try{
    var sh=SS().getSheetByName('Utilisateurs');if(!sh) return{success:false};
    var h=sh.getRange(1,1,1,11).getValues()[0];
    users.forEach(function(u,idx){sh.getRange(idx+2,1,1,h.length).setValues([h.map(function(k){return u[k]!==undefined?u[k]:'';})]);});
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────
function exportVersSheets(type){
  try{
    var dFmt=Utilities.formatDate(new Date(),'Europe/Paris','yyyyMMdd_HHmm');
    var nss=SpreadsheetApp.create('MAISON41_Export_'+type+'_'+dFmt);
    var _wsFirstSheet=true;
    function ws(name,headers,rows){
      // FIX: premier appel = renommer la feuille active, appels suivants = créer une nouvelle feuille
      var sh=_wsFirstSheet?nss.getActiveSheet().setName(name):nss.insertSheet(name);
      _wsFirstSheet=false;
      sh.appendRow(headers);rows.forEach(function(r){sh.appendRow(r);});
      sh.getRange(1,1,1,headers.length).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
      sh.setFrozenRows(1);sh.autoResizeColumns(1,headers.length);
    }
    if(type==='ventes'){var d=readSheet('Ventes').filter(function(r){return r['Date'];});ws('Ventes',['Date','Canal','Client','Recette','Format','Qté','PU HT','Net HT','TTC'],d.map(function(r){return[r['Date'],r['Canal'],r['Client'],r['Recette'],r['Format Weck']||r['Format']||'',r['Qte']||0,r['PU HT EUR']||0,r['Net HT EUR']||0,r['TTC EUR']||0];}));
    }else if(type==='compta'){var d=readSheet('Compta').filter(function(r){return r['Date'];});ws('Comptabilite',['Date','Type','Catégorie','Description','Montant HT','TVA %','TTC','Mode'],d.map(function(r){return[r['Date'],r['Type'],r['Categorie']||r['Catégorie']||'',r['Description'],r['Montant EUR']||0,r['TVA %']||0,r['TTC EUR']||0,r['Mode paiement']||r['Mode']||''];}));
    }else if(type==='planning'){var d=readSheet('Planning').filter(function(r){return r['Date'];});ws('Planning',['Date','N° Lot','Recette','Autoclave','Format','Fraction','Bocaux plan.','T° CCP1'],d.map(function(r){return[r['Date'],r['N Lot (auto)']||r['N Lot']||'',r['Recette']||'',r['Autoclave']||'',r['Format Weck']||r['Format']||'',r['Fraction']||'',r['Nb bocaux plan.']||r['Bocaux Planifies']||0,r['T coeur (C)']||r['Temp Coeur']||0];}));
    }else if(type==='stock'){var d=readSheet('Stock').filter(function(r){return r['Code']||r['Code MP'];});ws('Stock',['Code','Désignation','Stock actuel','Seuil','Statut'],d.map(function(r){return[r['Code']||r['Code MP']||'',r['Designation']||r['Désignation']||'',r['Stock actuel']||r['Stock Actuel']||r['Qte']||0,r['Seuil alerte']||r['Seuil Alerte']||r['Seuil']||0,r['Statut']||r['Alerte']||''];}));
    }else if(type==='clients'){var shCli=SS().getSheetByName('👤 Clients')||SS().getSheetByName('Clients');var d=shCli?readSheet(shCli.getName()).filter(function(r){return r['Nom'];}):[];ws('Clients',['ID','Prénom','Nom','Email','Téléphone','Département','Type','Statut Ulule','CA Total'],d.map(function(r){return[r['ID']||'',r['Prenom']||r['Prénom']||'',r['Nom']||'',r['Email']||'',r['Telephone']||r['Téléphone']||'',r['Departement']||r['Département']||'',r['Type']||'',r['Statut Ulule']||'',r['CA total']||0];}));}
    // type='previsionnel'
    if(type==='previsionnel'){var d=readSheet('Previsionnel').filter(function(r){return r['Mois'];});ws('Prévisionnel',['Mois','CA Prévisionnel','CA Réel','Charges Prévues','Charges Réelles','Tréso Prév','Tréso Réelle','Écart'],d.map(function(r){var caPrev=parseFloat(r['CA Previsionnel']||r['CA Prevu']||0),caReal=parseFloat(r['CA Reel']||0),chPrev=parseFloat(r['Charges Prevues']||0),chReal=parseFloat(r['Charges Reelles']||0);return[r['Mois'],caPrev,caReal,chPrev,chReal,caPrev-chPrev,caReal-chReal,(caReal-chReal)-(caPrev-chPrev)];}))}
    return{success:true,url:nss.getUrl(),name:nss.getName()};
  }catch(e){Logger.log('exportVersSheets:'+e.message);return{success:false,error:e.message};}
}

// ─── NOTIFICATIONS PUSH — ntfy.sh ────────────────────────────────────────
// Config keys requis dans la feuille Config :
//   "ntfy Topic"    → ex: maison41-xyz123  (votre topic privé sur ntfy.sh)
//   "ntfy Priority" → low | default | high | urgent  (défaut: high)
// App mobile ntfy : https://ntfy.sh  — Android + iOS, gratuit
function _sendPush(title, message, priority, tags){
  try{
    var cfg=readConfig();
    var topic=String(cfg['ntfy Topic']||'').trim();
    if(!topic) return; // Push non configuré — silencieux
    var prio=priority||cfg['ntfy Priority']||'high';
    UrlFetchApp.fetch('https://ntfy.sh/'+topic,{
      method:'POST',
      headers:{
        'Title':title,
        'Priority':prio,
        'Tags':tags||'warning,maison41',
        'Content-Type':'text/plain; charset=utf-8'
      },
      payload:message,
      muteHttpExceptions:true
    });
    Logger.log('_sendPush: envoyé → '+topic+' | '+title);
  }catch(e){Logger.log('_sendPush error: '+e.message);}
}

// ─── ALERTES QUOTIDIENNES — email + push ntfy.sh ───────────────────────────
// Déclencheur : setupTriggers() → chaque jour à 7h
function checkDailyAlerts(){
  try{
    var kpi=getDashboardData(),alerts=[],dFR=Utilities.formatDate(new Date(),'Europe/Paris','dd/MM/yyyy');
    // FIX #9 : alerte réclamations critiques "danger santé" non clôturées → DDPP urgence
    try{
      var shRec2=SS().getSheetByName('Réclamations')||SS().getSheetByName('Reclamations');
      if(shRec2){
        var rd2=shRec2.getDataRange().getValues();
        for(var ri=3;ri<rd2.length;ri++){
          if(!rd2[ri][2]) continue;
          var grav=String(rd2[ri][7]||'').toLowerCase();
          var stat=String(rd2[ri][12]||'').toLowerCase();
          if(grav.indexOf('danger')>=0&&stat.indexOf('clot')<0&&stat!=='archive'){
            alerts.unshift('🚨 URGENT DDPP — Réclamation danger santé non clôturée : '+String(rd2[ri][2]||'')+ ' / Lot: '+String(rd2[ri][4]||'NC')+' — Réponse sous 24h obligatoire');
          }
        }
      }
    }catch(e9){Logger.log('FIX9 récl. critiques: '+e9.message);}
    if(kpi.mpRuptures>0) alerts.push('⚠️ '+kpi.mpRuptures+' MP en rupture — commander immédiatement');
    if(kpi.ddmExpires>0) alerts.push('🗑️ '+kpi.ddmExpires+' lot(s) DDM EXPIRÉS — retirer du stock');
    if(kpi.ddmProches>0) alerts.push('⏳ '+kpi.ddmProches+' lot(s) DDM < 30j — prioriser la vente');
    if(kpi.haccpNC>0) alerts.push('🛡️ '+kpi.haccpNC+' NC HACCP ouverte(s)');
    if(kpi.reclOuv>0) alerts.push('📮 '+kpi.reclOuv+' réclamation(s) non clôturée(s)');
    if(kpi.seuilRentabilite>0&&kpi.caMonth<kpi.seuilRentabilite) alerts.push('💰 CA mois ('+Math.round(kpi.caMonth)+'€) sous seuil ('+Math.round(kpi.seuilRentabilite)+'€)');
    if(!alerts.length){Logger.log('checkDailyAlerts: RAS');return;}
    var email=Session.getActiveUser().getEmail();
    if(email&&email.indexOf('@')>0){
      MailApp.sendEmail({to:email,subject:'[MAISON 41] '+alerts.length+' alerte(s) du '+dFR,
        htmlBody:'<div style="font-family:sans-serif;max-width:560px"><div style="background:#0d0d0d;padding:20px 24px"><span style="font-size:22px;color:#f0c060;font-weight:300">🐗 Maison 41</span></div><div style="padding:16px 24px;background:#f5f1e8;border-bottom:2px solid #c8820a"><strong>'+alerts.length+' alerte(s) — '+dFR+'</strong></div><ul style="padding:16px 24px;margin:0">'+alerts.map(function(a){return'<li style="padding:6px 0;border-bottom:1px solid #e8e4da;list-style:none">'+a+'</li>';}).join('')+'</ul><div style="padding:12px 24px;color:#888;font-size:11px">MAISON 41 ERP OS v3 · Conserverie artisanale · Cognac</div></div>'
      });
    }
    Logger.log('checkDailyAlerts: '+alerts.length+' alerte(s) envoyée(s)');
    // ── Push ntfy.sh ──
    var urgents=alerts.filter(function(a){return a.indexOf('URGENT')>=0||a.indexOf('danger')>=0;});
    var pushPrio=urgents.length?'urgent':'high';
    var pushTitle='[Maison 41] '+alerts.length+' alerte(s) — '+dFR;
    var pushBody=alerts.join('\n');
    _sendPush(pushTitle,pushBody,pushPrio,'warning');
  }catch(e){Logger.log('checkDailyAlerts ERROR:'+e.message);}
}


// ─── FICHE LOT — VALIDATION & AUTO STOCK ──────────────────────────────────
function saveFicheLotStatus(obj){
  try{
    var ss=SS(),numLot=obj.numLot||'',statut=obj.statut||'En production';
    // 1. Mettre à jour Planning
    var shP=ss.getSheetByName('Planning');
    if(shP){
      var pd=shP.getDataRange().getValues();
      for(var i=3;i<pd.length;i++){
        var lotCell=String(pd[i][1]||'');
        if(lotCell===numLot){
          shP.getRange(i+1,10).setValue(parseInt(obj.bocauxReels)||''); // col 10 = Nb bocaux reels
          shP.getRange(i+1,15).setValue(parseFloat(obj.tempCoeur)||''); // col 15 = T coeur (C)
          shP.getRange(i+1,16).setValue(statut);                        // col 16 = Statut
          shP.getRange(i+1,18).setValue(obj.operateur||'');             // col 18 = Operateur
          shP.getRange(i+1,19).setValue(obj.observations||'');          // col 19 = Notes
          break;
        }
      }
    }
    // 2. Si Validé → Historique Lots : FIX #6 — n'écrire QUE le N° Lot en col A
    // Les formules INDEX/MATCH du Sheets calculent automatiquement les autres colonnes
    if(statut==='Validé'){
      var shH=ss.getSheetByName('Historique Lots');
      if(shH){
        var row=firstEmptyRow(shH,1,4);
        shH.getRange(row,1).setValue(numLot);
      }
    }
    // 3. Si NC → créer une fiche HACCP automatiquement
    if(statut==='NC'){
      saveHACCP({
        date:obj.date||Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd'),
        type:'CCP1 — Température cœur',
        description:'NC AUTO — Lot '+numLot+' — '+(obj.recette||'')+' — T°='+obj.tempCoeur+'°C (requis ≥'+obj.tempCCP1Min+'°C)',
        valeur:parseFloat(obj.tempCoeur)||0,
        limite:parseFloat(obj.tempCCP1Min)||115,
        action:'Lot isolé en attente de décision — Ne pas commercialiser',
        responsable:obj.operateur||''
      });
    }
    return{success:true};
  }catch(e){Logger.log('saveFicheLotStatus:'+e.message);return{success:false,error:e.message};}
}

// ─── HISTORIQUE LOTS ──────────────────────────────────────────────────────
function getHistoriqueData(){
  try{
    var r={};
    r.historiqueLots=readSheet('Historique Lots').filter(function(x){return x['N Lot']||x['Num Lot'];}).slice(0,150);
    return r;
  }catch(e){Logger.log('getHistoriqueData:'+e.message);return{error:e.message};}
}

// ─── CE & ASSOCIATIONS ────────────────────────────────────────────────────
function getCEData(){
  try{
    var r={};
    var shCE=SS().getSheetByName('CE & Associations');
    r.ceCommandes=shCE?readSheet('CE & Associations').filter(function(x){return x['Organisme']||x['Client'];}).slice(0,80):[];
    return r;
  }catch(e){Logger.log('getCEData:'+e.message);return{error:e.message};}
}

function saveCECommande(cmd){
  try{
    var sh=SS().getSheetByName('CE & Associations');
    if(!sh) return{success:false,error:'Feuille CE & Associations introuvable'};
    var row=firstEmptyRow(sh,1,4),d=cmd.date?new Date(cmd.date):new Date();
    var num='CE-'+Utilities.formatDate(d,'Europe/Paris','yyyy')+'-'+String(row-3).padStart(3,'0');
    var ligStr=(cmd.lignes||[]).map(function(l){return l.nom+' '+l.format+' ×'+l.qte;}).join(' | ');
    sh.getRange(row,1,1,12).setValues([[num,cmd.organisme||'',cmd.contact||'',cmd.email||'',d,ligStr,JSON.stringify(cmd.lignes||[]),parseInt(cmd.totalBocaux)||0,parseFloat(cmd.totalHT)||0,parseFloat(cmd.remise)||0,parseFloat(cmd.netHT)||0,'En attente']]);
    // Écriture des lignes dans Bons de Commande aussi pour la traçabilité
    saveBC({date:Utilities.formatDate(d,'Europe/Paris','yyyy-MM-dd'),client:cmd.organisme||'CE',lignes:cmd.lignes||[],notes:'CE — Remise '+cmd.remise+'%'});
    return{success:true,row:row,numCE:num};
  }catch(e){Logger.log('saveCECommande:'+e.message);return{success:false,error:e.message};}
}

// ─── PRIX VENTE — MISE À JOUR BATCH ──────────────────────────────────────
function savePrixVenteBatch(updates){
  try{
    var sh=SS().getSheetByName('Prix Vente');
    if(!sh) return{success:false,error:'Feuille Prix Vente introuvable'};
    var d=sh.getDataRange().getValues();
    // En-tête à la ligne 4 (index 3) : Gamme | Format Weck | B TO C MARCHES (TTC) | ...
    var h=d[3];
    var colGamme=0,colFormat=1,colB2C=2; // colonnes fixes selon structure réelle
    var count=0;
    updates.forEach(function(u){
      // Données à partir de la ligne 8 (index 7)
      for(var i=7;i<d.length;i++){
        var fmtCell=String(d[i][colFormat]||'').replace(/\s/g,'');
        var fmtTarget=String(u.format||'').replace(/\s/g,'');
        if(String(d[i][colGamme])===u.gamme&&fmtCell===fmtTarget){
          sh.getRange(i+1,colB2C+1).setValue(parseFloat(u.b2c)||0);
          count++;break;
        }
      }
    });
    return{success:true,updated:count};
  }catch(e){Logger.log('savePrixVenteBatch:'+e.message);return{success:false,error:e.message};}
}

// ─── DUERP ────────────────────────────────────────────────────────────────
function saveDUERP(obj){
  try{
    var sh=SS().getSheetByName('DUERP');
    if(!sh) return{success:false,error:'Feuille DUERP introuvable'};
    var row=firstEmptyRow(sh,1,4);
    var score=parseInt(obj.probabilite||1)*parseInt(obj.gravite||1);
    var niveau=score>=9?'Critique':score>=5?'Modéré':'Faible';
    sh.getRange(row,1,1,10).setValues([[obj.unite||'',obj.risque||'',parseInt(obj.probabilite)||1,parseInt(obj.gravite)||1,score,niveau,obj.action||'',obj.responsable||'',obj.delai?new Date(obj.delai):'','Ouvert']]);
    return{success:true,row:row,score:score};
  }catch(e){Logger.log('saveDUERP:'+e.message);return{success:false,error:e.message};}
}

// ─── EXPORT PRÉVISIONNEL ──────────────────────────────────────────────────
// (exportVersSheets existante étendue avec le type 'previsionnel')
// Override partiel — ajouter dans exportVersSheets le case 'previsionnel'

function setupTriggers(){
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  // Alerte email + push quotidienne à 7h
  ScriptApp.newTrigger('checkDailyAlerts').timeBased().everyDays(1).atHour(7).create();
  // Vérification push urgente toutes les heures (NC HACCP, rupture critique)
  ScriptApp.newTrigger('checkUrgentAlerts').timeBased().everyHours(1).create();
  Logger.log('Triggers configurés : checkDailyAlerts à 7h + checkUrgentAlerts toutes les heures');
}

// Vérification horaire — uniquement les alertes critiques → push immédiat, pas d'email
function checkUrgentAlerts(){
  try{
    var ss=SS(),alerts=[];
    // 1. NC HACCP ouvertes
    var shH=ss.getSheetByName('HACCP');
    if(shH){
      var hd=shH.getDataRange().getValues();
      for(var i=3;i<hd.length;i++) if(String(hd[i][5])==='NC') alerts.push('🛡️ NC HACCP: '+String(hd[i][2]||'').substring(0,40));
    }
    // 2. Réclamations danger santé non clôturées
    var shR=ss.getSheetByName('Réclamations')||ss.getSheetByName('Reclamations');
    if(shR){
      var rd=shR.getDataRange().getValues();
      for(var i=3;i<rd.length;i++){
        if(!rd[i][2]) continue;
        var grav=String(rd[i][7]||'').toLowerCase();
        var stat=String(rd[i][12]||'').toLowerCase();
        if(grav.indexOf('danger')>=0&&stat.indexOf('clot')<0) alerts.push('🚨 URGENT: réclamation danger santé — '+String(rd[i][2]||''));
      }
    }
    if(!alerts.length) return;
    _sendPush('[Maison 41] URGENT — '+alerts.length+' alerte(s) critique(s)',alerts.join('\n'),'urgent','rotating_light');
  }catch(e){Logger.log('checkUrgentAlerts ERROR: '+e.message);}
}

// ─── CONFIGURATION — SAUVEGARDE ───────────────────────────────────────────
function saveConfigBatch(updates){
  try{
    var sh=SS().getSheetByName('Config');
    if(!sh) return{success:false,error:'Feuille Config introuvable'};
    var d=sh.getDataRange().getValues();
    var count=0;
    updates.forEach(function(u){
      if(!u.cle||u.valeur===undefined||u.valeur===null) return;
      var found=false;
      for(var i=0;i<d.length;i++){
        if(String(d[i][0]).trim()===String(u.cle).trim()){
          sh.getRange(i+1,2).setValue(u.valeur);
          d[i][1]=u.valeur; // mise à jour locale pour éviter les doublons
          count++;found=true;break;
        }
      }
      // FIX : si la clé n'existe pas encore → créer la ligne dans Config
      if(!found){
        var newRow=sh.getLastRow()+1;
        sh.getRange(newRow,1).setValue(String(u.cle).trim());
        sh.getRange(newRow,2).setValue(u.valeur);
        d.push([u.cle,u.valeur]); // mise à jour locale
        count++;
        Logger.log('saveConfigBatch: nouvelle clé créée → '+u.cle);
      }
    });
    return{success:true,updated:count};
  }catch(e){Logger.log('saveConfigBatch:'+e.message);return{success:false,error:e.message};}
}

// ─── CONFIGURATION — INITIALISATION CLÉS MANQUANTES ──────────────────────
// Appeler une fois manuellement depuis GAS si la feuille Config est incomplète
function initConfigDefaults(){
  var defaults=[
    ['SIRET',''],
    ['Numero agrement DDPP',''],
    ['Raison sociale','Maison 41'],
    ['Adresse','Cognac, France'],
    ['TVA Rillettes (%)','5.5'],
    ['TVA Pâtés (%)','5.5'],
    ['TVA Mousses (%)','5.5'],
    ['TVA Terrines (%)','5.5'],
    ['TVA Cassoulet (%)','5.5'],
    ['TVA Desserts (%)','5.5'],
    ['TVA Bocaux et accessoires (%)','20'],
    ['Marge minimale cible (%)','40'],
    ['Marge confort (%)','55'],
    ['Marge B2B (%)','35'],
    ['Marge restaurants (%)','25'],
    ['Marge epiceries (%)','30'],
    ['DDM Rillettes (mois)','24'],
    ['DDM Pâtés (mois)','18'],
    ['DDM Mousses (mois)','18'],
    ['DDM Terrines (mois)','24'],
    ['DDM Cassoulet (mois)','24'],
    ['DDM Desserts (mois)','12'],
    ['Autoclave temperature minimale (C)','115'],
    ['Cout energie par lot (EUR)',''],
    ['Taux main d oeuvre (EUR/h)',''],
    ['Cout moyen bocal (EUR)','']
  ];
  var existing=readConfig();
  var toAdd=defaults.filter(function(pair){return !(pair[0] in existing);});
  if(!toAdd.length){Logger.log('initConfigDefaults: aucune clé manquante');return{success:true,added:0};}
  var sh=SS().getSheetByName('Config');
  if(!sh) return{success:false,error:'Feuille Config introuvable'};
  toAdd.forEach(function(pair){
    var row=sh.getLastRow()+1;
    sh.getRange(row,1).setValue(pair[0]);
    sh.getRange(row,2).setValue(pair[1]);
  });
  Logger.log('initConfigDefaults: '+toAdd.length+' clés ajoutées → '+toAdd.map(function(p){return p[0];}).join(', '));
  return{success:true,added:toAdd.length,keys:toAdd.map(function(p){return p[0];})};
}
// ═══════════════════════════════════════════════════════════════════
// NOUVELLES FONCTIONS — Cockpit v2 + Actions
// ═══════════════════════════════════════════════════════════════════

// ─── ANNULATION LOT ───────────────────────────────────────────────
function cancelLot(numLot,callerRole,operateur){
  try{
    _requireRole(callerRole||'Gérant',['Gérant','Admin']);
    var ss=SS();
    var sh=ss.getSheetByName('Planning');
    if(!sh) return{success:false,error:'Feuille Planning introuvable'};
    var d=sh.getDataRange().getValues();
    for(var i=3;i<d.length;i++){
      var lot=String(d[i][1]||'');
      if(lot===numLot){
        var st=String(d[i][15]||'');
        if(st==='Validé') return{success:false,error:'Lot déjà validé — annulation impossible'};
        sh.getRange(i+1,16).setValue('Annulé');

        // ── 1. Écriture compensatrice en comptabilité ──
        saveComptaEntry({
          date:Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd'),
          type:'Perte',
          categorie:'Production — Lot annulé',
          description:'Annulation lot '+numLot+' — '+(String(d[i][2]||'')),
          montant:0, // valeur à 0 si le lot n'a pas été valorisé — ajuster si coût calculé
          tva:0,
          mode:'—',
          ref:numLot
        });

        // ── 2. Audit ──
        _writeAudit({nom:operateur||'',role:callerRole||''},'cancelLot',{numLot:numLot});

        return{success:true};
      }
    }
    return{success:false,error:'Lot non trouvé: '+numLot};
  }catch(e){Logger.log('cancelLot:'+e.message);return{success:false,error:e.message};}
}

// ─── MISE À JOUR MARCHÉ (édition) ─────────────────────────────────
function updateMarche(obj){
  try{
    var sh=SS().getSheetByName('Marches');
    if(!sh) return{success:false,error:'Feuille Marches introuvable'};
    var d=sh.getDataRange().getValues();
    for(var i=3;i<d.length;i++){
      var dCell=d[i][0];
      var dFmt=dCell instanceof Date?Utilities.formatDate(dCell,'Europe/Paris','yyyy-MM-dd'):String(dCell).split('T')[0];
      var lieu=String(d[i][1]||'');
      if(dFmt===obj.dateOld&&lieu===obj.lieuOld){
        sh.getRange(i+1,1).setValue(obj.date?new Date(obj.date):dCell);
        sh.getRange(i+1,2).setValue(obj.lieu||lieu);
        sh.getRange(i+1,3).setValue(obj.meteo||'');
        sh.getRange(i+1,4).setValue(parseFloat(obj.prevision)||0);
        sh.getRange(i+1,8).setValue(obj.notes||'');
        return{success:true};
      }
    }
    return saveMarche(obj);
  }catch(e){Logger.log('updateMarche:'+e.message);return{success:false,error:e.message};}
}

// ─── PRÉVISIONNEL — MISE À JOUR BATCH ─────────────────────────────
function updatePrevisionnel(items){
  try{
    var sh=SS().getSheetByName('Previsionnel');
    if(!sh) return{success:false,error:'Feuille Previsionnel introuvable'};
    var d=sh.getDataRange().getValues();
    var hIdx=0;
    for(var i=0;i<Math.min(d.length,10);i++){var sc=0;for(var j=0;j<d[i].length;j++){if(d[i][j]&&typeof d[i][j]==='string')sc++;}if(sc>=3){hIdx=i;break;}}
    var h=d[hIdx].map(function(x){return String(x).trim().toLowerCase();});
    var colM=h.findIndex(function(k){return k==='mois';})||0;
    var colCP=h.findIndex(function(k){return k.includes('ca')&&k.includes('prev');});
    var colCR=h.findIndex(function(k){return k.includes('ca')&&(k.includes('reel')||k.includes('réel'));});
    var colHP=h.findIndex(function(k){return k.includes('charge')&&k.includes('prev');});
    var colHR=h.findIndex(function(k){return k.includes('charge')&&(k.includes('reel')||k.includes('réel'));});
    var updated=0;
    items.forEach(function(item){
      for(var i=hIdx+1;i<d.length;i++){
        if(String(d[i][colM]||'').trim()===String(item.mois||'').trim()){
          if(colCP>=0&&item.caPrev!==undefined) sh.getRange(i+1,colCP+1).setValue(parseFloat(item.caPrev)||0);
          if(colCR>=0&&item.caReal!==undefined) sh.getRange(i+1,colCR+1).setValue(parseFloat(item.caReal)||0);
          if(colHP>=0&&item.chPrev!==undefined) sh.getRange(i+1,colHP+1).setValue(parseFloat(item.chPrev)||0);
          if(colHR>=0&&item.chReal!==undefined) sh.getRange(i+1,colHR+1).setValue(parseFloat(item.chReal)||0);
          updated++;break;
        }
      }
    });
    return{success:true,updated:updated};
  }catch(e){Logger.log('updatePrevisionnel:'+e.message);return{success:false,error:e.message};}
}

// ─── CHARGE — MISE À JOUR ─────────────────────────────────────────
function updateCharge(obj){
  try{
    var sh=SS().getSheetByName('Charges');
    if(!sh) return{success:false,error:'Feuille Charges introuvable'};
    var d=sh.getDataRange().getValues();
    for(var i=3;i<d.length;i++){
      if(String(d[i][0]||'').trim()===String(obj.posteOld||'').trim()
         &&String(d[i][4]||'').trim()===String(obj.moisOld||'').trim()){
        sh.getRange(i+1,1).setValue(obj.poste||'');
        sh.getRange(i+1,2).setValue(obj.type||'Fixe');
        sh.getRange(i+1,3).setValue(parseFloat(obj.montantEstime)||0);
        sh.getRange(i+1,4).setValue(parseFloat(obj.montantReel)||0);
        sh.getRange(i+1,5).setValue(obj.mois||'');
        sh.getRange(i+1,6).setValue(obj.notes||'');
        return{success:true};
      }
    }
    return{success:false,error:'Charge non trouvée — ligne introuvable'};
  }catch(e){Logger.log('updateCharge:'+e.message);return{success:false,error:e.message};}
}

// ─── CAISSE MARCHÉ — ENREGISTREMENT MULTI-LIGNES ──────────────────
function saveVenteCaisse(lignes,marcheInfo){
  try{
    var results=[];
    var d=Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd');
    lignes.forEach(function(l){
      var res=saveVente({
        date:d,canal:'Marchés',
        client:marcheInfo||'Client marché',
        recette:l.recette,format:l.format,
        qte:l.qte,puHT:l.puHT,remise:l.remise||0,
        notes:'Caisse — '+(marcheInfo||'')
      });
      results.push(res);
    });
    var totalHT=results.reduce(function(s,r){return s+(r.netHT||0);},0);
    return{success:true,count:lignes.length,totalHT:totalHT};
  }catch(e){Logger.log('saveVenteCaisse:'+e.message);return{success:false,error:e.message};}
}
// ─── PARC MACHINE ────────────────────────────────────────────────────────────
// Feuille "Parc Machine" — colonnes :
// A=ID | B=Nom | C=Type | D=Cap_RR290 | E=Cap_RR580 | F=Cap_RR850
// G=Cap_W050 | H=Cap_W080 | I=Debit_kg_h | J=Conso_kW | K=Statut | L=Notes
function getParcMachine(){
  try{
    var sh=SS().getSheetByName('Parc Machine');
    if(!sh){
      // Si la feuille n'existe pas encore, la créer avec les colonnes
      var nsh=SS().insertSheet('Parc Machine');
      nsh.getRange(1,1,1,12).setValues([['ID','Nom','Type','Cap_RR290','Cap_RR580','Cap_RR850','Cap_W050','Cap_W080','Debit_kg_h','Conso_kW','Statut','Notes']]);
      nsh.getRange(1,1,1,12).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
      nsh.setFrozenRows(1);
      nsh.autoResizeColumns(1,12);
      Logger.log('getParcMachine: feuille créée');
      return [];
    }
    var d=sh.getDataRange().getValues();
    if(d.length<2) return [];
    var h=d[0].map(function(x){return String(x).trim();});
    return d.slice(1).filter(function(row){return row[0];}).map(function(row){
      var o={};
      h.forEach(function(k,i){
        var v=row[i];
        if(v instanceof Date) v=Utilities.formatDate(v,'Europe/Paris','yyyy-MM-dd');
        o[k]=(v===null||v===undefined)?'':v;
      });
      return o;
    });
  }catch(e){Logger.log('getParcMachine: '+e.message);return [];}
}

function saveMachine(machine){
  try{
    var sh=SS().getSheetByName('Parc Machine');
    if(!sh){
      // Créer la feuille si absente
      getParcMachine();
      sh=SS().getSheetByName('Parc Machine');
    }
    if(!sh) return{success:false,error:'Parc Machine introuvable et impossible à créer'};
    var d=sh.getDataRange().getValues();
    if(d.length<1) return{success:false,error:'En-tête manquant dans Parc Machine'};
    // Cherche ligne existante par ID
    var targetRow=-1;
    for(var i=1;i<d.length;i++){
      if(d[i][0]&&String(d[i][0]).trim()===String(machine.id||'').trim()){targetRow=i+1;break;}
    }
    if(targetRow<0) targetRow=firstEmptyRow(sh,1,2);
    var id=machine.id||('MCH-'+Utilities.formatDate(new Date(),'Europe/Paris','yyyyMMddHHmmss'));
    var vals=[
      id,
      machine.nom||'',
      machine.type||'',
      parseInt(machine.capRR290)||0,
      parseInt(machine.capRR580)||0,
      parseInt(machine.capRR850)||0,
      parseInt(machine.capW050)||0,
      parseInt(machine.capW080)||0,
      parseFloat(machine.debitKgH)||0,
      parseFloat(machine.consoKW)||0,
      machine.statut||'Actif',
      machine.notes||''
    ];
    sh.getRange(targetRow,1,1,vals.length).setValues([vals]);
    return{success:true,row:targetRow,id:id};
  }catch(e){Logger.log('saveMachine: '+e.message);return{success:false,error:e.message};}
}

function deleteMachine(id){
  try{
    var sh=SS().getSheetByName('Parc Machine');
    if(!sh) return{success:false,error:'Feuille Parc Machine introuvable'};
    var d=sh.getDataRange().getValues();
    for(var i=1;i<d.length;i++){
      if(String(d[i][0]).trim()===String(id).trim()){
        sh.deleteRow(i+1);
        return{success:true};
      }
    }
    return{success:false,error:'Machine non trouvée: '+id};
  }catch(e){return{success:false,error:e.message};}
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAÇABILITÉ — Gemini Vision + Drive Archive
// ═══════════════════════════════════════════════════════════════════════════
// Config keys requis :
//   "Gemini API Key"             → clé obtenue sur aistudio.google.com (gratuit)
//   "Drive Tracabilite Folder ID"→ ID du dossier Drive racine pour les archives

// ─── OCR ÉTIQUETTE VIA GEMINI VISION ────────────────────────────────────────
function extractEtiquetteMP(imageBase64, mimeType){
  try{
    var cfg=readConfig();
    var apiKey=cfg['Gemini API Key']||'';
    if(!apiKey) return{success:false,error:'Clé API Gemini manquante — ajouter "Gemini API Key" dans Config'};

    var url='https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key='+apiKey;
    var prompt='Tu es un assistant de traçabilité alimentaire. Analyse cette photo d\'étiquette de matière première agroalimentaire.\n'
      +'Extrais exactement ces informations et réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balise markdown :\n'
      +'{"produit":"nom du produit","fournisseur":"nom du fournisseur ou marque",'
      +'"numLot":"numéro de lot (cherche L, LOT, Lot suivi de chiffres/lettres)",'
      +'"dateFabrication":"date fabrication YYYY-MM-DD ou null",'
      +'"dlc":"DLC ou DLUO YYYY-MM-DD ou null",'
      +'"poidsNet":"poids net en kg sous forme numérique ou null",'
      +'"origineViande":"pays d\'origine si visible sinon null",'
      +'"temperature":"température de conservation si indiquée sinon null"}\n'
      +'Si une info est illisible ou absente mets null. Ne devine jamais.';

    // Nettoie le préfixe data:image/... si présent
    var b64=imageBase64.replace(/^data:image\/\w+;base64,/,'');

    var payload={
      contents:[{parts:[{text:prompt},{inline_data:{mime_type:mimeType||'image/jpeg',data:b64}}]}],
      generationConfig:{temperature:0,maxOutputTokens:512}
    };

    var resp=UrlFetchApp.fetch(url,{
      method:'POST',contentType:'application/json',
      payload:JSON.stringify(payload),muteHttpExceptions:true
    });
    var raw=JSON.parse(resp.getContentText());
    if(raw.error) return{success:false,error:'Gemini: '+raw.error.message};
    var text=raw.candidates[0].content.parts[0].text.replace(/```json|```/g,'').trim();
    var parsed=JSON.parse(text);
    return{success:true,data:parsed};
  }catch(e){Logger.log('extractEtiquetteMP: '+e.message);return{success:false,error:e.message};}
}

// ─── UTILITAIRE DRIVE ────────────────────────────────────────────────────────
function getOrCreateDriveFolder(parentFolder,name){
  var it=parentFolder.getFoldersByName(name);
  return it.hasNext()?it.next():parentFolder.createFolder(name);
}

// ─── SAUVEGARDE TRAÇABILITÉ COMPLÈTE ────────────────────────────────────────
// tracData = {
//   numLot, dateProduction, recette, operateur,
//   ingredients: [{codeMp, nom, qteConsommee, numLotFourn, fournisseur,
//                  dlcFourn, dateReception, photoBase64, mimeType}]
// }
function saveTracabilite(tracData){
  try{
    var ss=SS();

    // ── 1. Créer feuille si absente ──
    var shName='Traçabilité Lots';
    var shT=ss.getSheetByName(shName);
    if(!shT){
      shT=ss.insertSheet(shName);
      var hdrs=['N° Lot','Date Production','Recette','Opérateur',
                'Code MP','Désignation MP','Qté consommée (kg)',
                'N° Lot Fournisseur','Fournisseur','DLC Fournisseur',
                'Date Réception','URL Photo Étiquette','URL Dossier Drive'];
      shT.getRange(1,1,1,hdrs.length).setValues([hdrs]);
      shT.getRange(1,1,1,hdrs.length).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
      shT.setFrozenRows(1);shT.autoResizeColumns(1,hdrs.length);
    }

    // ── 2. Créer dossier Drive pour ce lot ──
    var dossierUrl='',dossierLot=null;
    try{
      var cfg=readConfig();
      var rootId=cfg['Drive Tracabilite Folder ID']||'';
      var root=rootId?DriveApp.getFolderById(rootId):DriveApp.getRootFolder();
      var maison41=getOrCreateDriveFolder(root,'MAISON41 — Traçabilité');
      var yearF=getOrCreateDriveFolder(maison41,String(new Date().getFullYear()));
      dossierLot=getOrCreateDriveFolder(yearF,tracData.numLot||'LOT-INCONNU');
      dossierUrl=dossierLot.getUrl();
    }catch(eDr){Logger.log('saveTracabilite Drive: '+eDr.message);}

    // ── 3. Écrire une ligne par MP + uploader photo ──
    var row=firstEmptyRow(shT,1,2);
    var dateP=tracData.dateProduction?new Date(tracData.dateProduction):new Date();

    (tracData.ingredients||[]).forEach(function(ing,idx){
      var photoUrl='';
      if(ing.photoBase64&&dossierLot){
        try{
          var b64clean=ing.photoBase64.replace(/^data:image\/\w+;base64,/,'');
          var fname=tracData.numLot+'_'+(ing.codeMp||'MP'+idx)+'_'
                   +(ing.nom||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,20)+'.jpg';
          var blob=Utilities.newBlob(Utilities.base64Decode(b64clean),ing.mimeType||'image/jpeg',fname);
          var f=dossierLot.createFile(blob);
          f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
          photoUrl=f.getUrl();
        }catch(ep){Logger.log('saveTracabilite photo: '+ep.message);}
      }
      var dlcDate=ing.dlcFourn?new Date(ing.dlcFourn):'';
      var recDate=ing.dateReception?new Date(ing.dateReception):'';
      shT.getRange(row+idx,1,1,13).setValues([[
        tracData.numLot||'',dateP,tracData.recette||'',tracData.operateur||'',
        ing.codeMp||'',ing.nom||'',parseFloat(ing.qteConsommee)||'',
        ing.numLotFourn||'',ing.fournisseur||'',dlcDate,recDate,
        photoUrl,dossierUrl
      ]]);
    });

    // ── 4. Marquer le lot comme Tracé dans Planning (col 20) ──
    try{
      var shP=ss.getSheetByName('Planning');
      if(shP){
        var pd=shP.getDataRange().getValues();
        for(var i=3;i<pd.length;i++){
          if(String(pd[i][1])===String(tracData.numLot)){
            shP.getRange(i+1,20).setValue('✓ Tracé');break;
          }
        }
      }
    }catch(eP){}

    Logger.log('saveTracabilite: '+tracData.numLot+' → '+(tracData.ingredients||[]).length+' MP');
    return{success:true,dossierUrl:dossierUrl,lignes:(tracData.ingredients||[]).length};
  }catch(e){Logger.log('saveTracabilite: '+e.message);return{success:false,error:e.message};}
}

// ─── LECTURE DONNÉES TRAÇABILITÉ ─────────────────────────────────────────────
function getTracabiliteData(){
  try{
    var sh=SS().getSheetByName('Traçabilité Lots');
    if(!sh) return{tracabilite:[]};
    var rows=readSheet('Traçabilité Lots').filter(function(x){return x['N° Lot'];}).slice(0,300);
    return{tracabilite:rows};
  }catch(e){Logger.log('getTracabiliteData: '+e.message);return{error:e.message,tracabilite:[]};}
}

// ─── RECHERCHE AMONT / AVAL ──────────────────────────────────────────────────
function searchTracabilite(query){
  try{
    var sh=SS().getSheetByName('Traçabilité Lots');
    if(!sh) return{amont:[],aval:[]};
    var rows=readSheet('Traçabilité Lots').filter(function(x){return x['N° Lot'];});
    var q=String(query||'').trim().toLowerCase();
    if(!q) return{amont:[],aval:[]};
    var amont=rows.filter(function(r){return String(r['N° Lot']||'').toLowerCase().includes(q);});
    var aval=rows.filter(function(r){return String(r['N° Lot Fournisseur']||'').toLowerCase().includes(q);});
    return{amont:amont,aval:aval};
  }catch(e){return{amont:[],aval:[],error:e.message};}
}

// ═══════════════════════════════════════════════════════════════════════════
// NOUVELLES FONCTIONS — v8 (corrections commerciales)
// ═══════════════════════════════════════════════════════════════════════════

// ─── AVOIRS / RETOURS ─────────────────────────────────────────────────────
// Crée un avoir = ligne Ventes négative + écriture Compta compensatrice.
// avoir = { date, client, recette, format, qte, puHT, remise, refVenteOriginale,
//           motif, operateur, callerRole }
function saveAvoir(avoir){
  try{
    var sh=SS().getSheetByName('Ventes');
    if(!sh) return{success:false,error:'Feuille Ventes introuvable'};
    var row=firstEmptyRow(sh,1,5),d=avoir.date?new Date(avoir.date):new Date();
    var qte=parseFloat(avoir.qte)||0;
    var puHT=parseFloat(avoir.puHT)||0;
    var remise=parseFloat(avoir.remise)||0;
    var netHT=-(qte*puHT*(1-remise/100)); // NÉGATIF
    var numAvoir='AV-'+Utilities.formatDate(d,'Europe/Paris','yyyyMMdd')+'-'+String(row).padStart(3,'0');
    sh.getRange(row,1,1,14).setValues([[
      d,numAvoir,'Avoir',avoir.client||'',avoir.recette||'','',avoir.format||'',
      -qte,puHT,remise,netHT,'','',
      'Avoir — '+(avoir.motif||'Retour client')+(avoir.refVenteOriginale?' — Réf: '+avoir.refVenteOriginale:'')
    ]]);
    // Ecriture compta négative
    var cfg=readConfig();
    var tva=parseFloat(cfg['TVA '+(avoir.gamme||'')+' (%)'])||5.5;
    saveComptaEntry({
      date:Utilities.formatDate(d,'Europe/Paris','yyyy-MM-dd'),
      type:'Avoir',
      categorie:'Avoir client',
      description:'Avoir '+numAvoir+' — '+(avoir.recette||'')+' — '+(avoir.client||''),
      montant:netHT, // déjà négatif
      tva:tva,
      mode:'Avoir',
      ref:numAvoir
    });
    _writeAudit({nom:avoir.operateur||'',role:avoir.callerRole||''},'saveAvoir',{numAvoir:numAvoir,refOrigine:avoir.refVenteOriginale,montant:netHT});
    return{success:true,row:row,numAvoir:numAvoir,montantHT:netHT};
  }catch(e){Logger.log('saveAvoir:'+e.message);return{success:false,error:e.message};}
}

// ─── EXPORT FEC (Fichier des Écritures Comptables — norme DGFiP) ──────────
// Format : CSV délimité | (pipe), colonnes obligatoires selon arrêté 2013.
// Retourne { success, url, name } — crée un Sheet puis exporte en valeur.
function exportFEC(){
  try{
    var entries=readSheet('Compta').filter(function(r){return r['Date'];});
    if(!entries.length) return{success:false,error:'Aucune écriture en Compta'};
    var cfg=readConfig();
    var siret=String(cfg['SIRET']||'00000000000000').replace(/\s/g,'');
    // Colonnes FEC obligatoires (art. A47A-1 LPF)
    var hdrs=[
      'JournalCode','JournalLib','EcritureNum','EcritureDate',
      'CompteNum','CompteLib','CompAuxNum','CompAuxLib',
      'PieceRef','PieceDate','EcritureLib',
      'Debit','Credit',
      'EcritureLet','DateLet','ValidDate','Montantdevise','Idevise'
    ];
    var rows=[];
    var ecritureSeq=1;
    entries.forEach(function(e){
      var dateRaw=String(e['Date']||'').split('T')[0];
      var dateNum=dateRaw.replace(/-/g,''); // YYYYMMDD
      var montant=parseFloat(e['Montant EUR']||e['Montant HT']||0);
      var tvaEur=parseFloat(e['TVA EUR']||0);
      var type=String(e['Type']||'');
      var ref=String(e['Réf']||e['Ref']||e['ref']||'');
      var desc=String(e['Description']||'').substring(0,60);
      var numEcr=siret+dateNum.substring(0,8)+String(ecritureSeq).padStart(6,'0');
      ecritureSeq++;

      // Détermine le sens Débit/Crédit selon le type
      var isEncaissement=(type==='Encaissement'||type==='Vente');
      var isCharge=(type==='Charge'||type==='Perte'||type==='Achat');
      var isAvoir=(type==='Avoir');

      // Ligne 1 : compte de vente/charge
      var compteNum=isEncaissement?'706000':(isAvoir?'709000':'606000');
      var compteLib=isEncaissement?'Produits — ventes':(isAvoir?'Rabais, remises, ristournes accordés':'Achats et charges');
      var debitLigne1=isCharge?Math.abs(montant).toFixed(2):'0.00';
      var creditLigne1=(!isCharge)?Math.abs(montant).toFixed(2):'0.00';

      rows.push([
        isEncaissement||isAvoir?'VT':'AC',
        isEncaissement||isAvoir?'Ventes':'Achats/Charges',
        numEcr, dateNum,
        compteNum, compteLib, '', '',
        ref, dateNum, desc,
        debitLigne1, creditLigne1,
        '','','','',''
      ]);

      // Ligne 2 : compte de trésorerie (512/531)
      if(Math.abs(montant)>0){
        var mode=String(e['Mode paiement']||e['Mode']||'');
        var tresoNum=(mode==='Espèces'||mode==='Cash')?'531000':'512000';
        var tresoLib=(mode==='Espèces'||mode==='Cash')?'Caisse':'Banque';
        rows.push([
          isEncaissement||isAvoir?'VT':'AC',
          isEncaissement||isAvoir?'Ventes':'Achats/Charges',
          numEcr, dateNum,
          tresoNum, tresoLib, '', '',
          ref, dateNum, desc,
          (!isCharge)?Math.abs(montant).toFixed(2):'0.00',
          isCharge?Math.abs(montant).toFixed(2):'0.00',
          '','','','',''
        ]);
      }

      // Ligne 3 : TVA collectée / déductible
      if(Math.abs(tvaEur)>0.01){
        var tvaNum=isEncaissement?'445710':'445660';
        var tvaLib=isEncaissement?'TVA collectée':'TVA déductible';
        rows.push([
          isEncaissement?'VT':'AC',
          isEncaissement?'Ventes':'Achats/Charges',
          numEcr, dateNum,
          tvaNum, tvaLib, '', '',
          ref, dateNum, 'TVA — '+desc,
          isEncaissement?'0.00':Math.abs(tvaEur).toFixed(2),
          isEncaissement?Math.abs(tvaEur).toFixed(2):'0.00',
          '','','','',''
        ]);
      }
    });

    // Crée un Sheets d'export
    var dFmt=Utilities.formatDate(new Date(),'Europe/Paris','yyyyMMdd_HHmm');
    var nss=SpreadsheetApp.create('MAISON41_FEC_'+siret+'_'+dFmt);
    var sheet=nss.getActiveSheet().setName('FEC');
    sheet.appendRow(hdrs);
    rows.forEach(function(r){sheet.appendRow(r);});
    sheet.getRange(1,1,1,hdrs.length).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1,hdrs.length);
    // Note : pour export TXT pipe-délimité conforme DGFiP, télécharger en CSV puis renommer
    return{success:true,url:nss.getUrl(),name:nss.getName(),lignes:rows.length};
  }catch(e){Logger.log('exportFEC:'+e.message);return{success:false,error:e.message};}
}

// ─── ÉTAT TVA DÉCLARATIF (CA3 simplifié) ──────────────────────────────────
// Retourne TVA collectée et TVA déductible pour la période donnée.
// periode = { mois: 'yyyy-MM' }  (si omis → mois en cours)
function getEtatTVA(periode){
  try{
    var now=new Date();
    var moisCible=periode&&periode.mois?periode.mois:Utilities.formatDate(now,'Europe/Paris','yyyy-MM');
    var entries=readSheet('Compta').filter(function(r){return r['Date'];});
    var collectee=0, deductible=0;
    entries.forEach(function(e){
      var dm=String(e['Date']||'').substring(0,7);
      if(dm!==moisCible) return;
      var tvaEur=parseFloat(e['TVA EUR']||0);
      var type=String(e['Type']||'');
      if(type==='Encaissement'||type==='Vente') collectee+=tvaEur;
      else if(type==='Charge'||type==='Achat') deductible+=tvaEur;
      else if(type==='Avoir') collectee-=Math.abs(tvaEur);
    });
    var solde=collectee-deductible;
    return{
      success:true,
      periode:moisCible,
      tvaCollectee:Math.round(collectee*100)/100,
      tvaDéductible:Math.round(deductible*100)/100,
      soldeTVA:Math.round(solde*100)/100,
      typeDeclaration:solde>=0?'TVA à payer':'Crédit de TVA'
    };
  }catch(e){Logger.log('getEtatTVA:'+e.message);return{success:false,error:e.message};}
}

// ─── AUDIT LOG — LECTURE ──────────────────────────────────────────────────
function getAuditLog(limit){
  try{
    var sh=SS().getSheetByName('AuditLog');
    if(!sh) return{entries:[]};
    var rows=readSheet('AuditLog').slice(0,parseInt(limit)||200).reverse();
    return{entries:rows};
  }catch(e){return{entries:[],error:e.message};}
}

// ─── INITIALISATION — CRÉER TOUTES LES FEUILLES REQUISES ─────────────────
// À appeler UNE FOIS lors de l'installation. Idempotent.
function setupSpreadsheet(){
  try{
    var ss=SS();
    var created=[];

    function mkSheet(name,headers,startRow){
      if(ss.getSheetByName(name)){Logger.log('setupSpreadsheet: '+name+' déjà existante');return;}
      var sh=ss.insertSheet(name);
      var hRow=startRow||1;
      // Lignes vides avant header si demandé
      for(var i=1;i<hRow;i++) sh.appendRow(['']);
      sh.getRange(hRow,1,1,headers.length).setValues([headers]);
      sh.getRange(hRow,1,1,headers.length).setBackground('#0d0d0d').setFontColor('#f0c060').setFontWeight('bold');
      sh.setFrozenRows(hRow);
      sh.autoResizeColumns(1,headers.length);
      created.push(name);
      Logger.log('setupSpreadsheet: créée → '+name);
    }

    mkSheet('Config',['Clé','Valeur']);
    mkSheet('Utilisateurs',['Nom','Rôle','PIN','Email','Actif']);
    mkSheet('AuditLog',['Horodatage','Utilisateur','Rôle','Action','Détail']);
    mkSheet('Recettes',['Ref.','Nom commercial','Gamme','Format principal','Rendement %','Batch kg MP','Temps (h)','Statut','Nb ing.','Cout MP/kg','Date creation','Gluten','Oeufs','Lait','Sulfites','Moutarde','Autres allerg.','kcal/100g','Prot.','Lip.','Gluc.','Sel','Sync App'],3);
    mkSheet('Detail Recettes',['Ref. recette','Code MP','Designation MP','Qte par batch','Unite','Prix MP (EUR)','Cout ligne','% cout'],4);
    mkSheet('Fiches Techniques',['Ref.','Produit','Gluten','Crustaces','Oeufs','Poissons','Arachides','Lait','Fruits','Celeri','Moutarde','Sesame','Sulfites','Lupin','Mollusques','Traces','kcal','Prot','Lip','Gluc','Sel','Bareme steril.','DDM mois','N° agrement'],4);
    mkSheet('MP Référentiel',['Code MP','Designation','Categorie','Unite','Fournisseur','Prix EUR/U','Date MAJ','Stock min','Allergenes','Notes'],4);
    mkSheet('Stock',['Code MP','Désignation','Catégorie','Unité','Stock actuel','Seuil alerte','Conso 7j','Statut'],5);
    mkSheet('Planning',['Date','N Lot (auto)','Recette','Gamme','Format Weck','Autoclave','Fraction','Cap max','Nb bocaux plan.','Nb bocaux reels','','','','','T coeur (C)','Statut','','Operateur','Notes','Tracé'],3);
    mkSheet('HACCP',['Date','Type controle','Description','Valeur mesurée','Limite CCP','Résultat','Action corrective','Responsable','Date clôture','Notes'],3);
    mkSheet('Autoclaves',['Date','Autoclave','N° Lot','Recette','Format','Nb bocaux','T° max (°C)','Durée (min)','Coût énergie','Résultat','Notes'],3);
    mkSheet('Historique Lots',['N° Lot','Date','Recette','Gamme','Format','Bocaux validés','T° CCP1','Opérateur','Statut','Drive']);
    mkSheet('Traçabilité Lots',['N° Lot','Date Production','Recette','Opérateur','Code MP','Désignation MP','Qté consommée (kg)','N° Lot Fournisseur','Fournisseur','DLC Fournisseur','Date Réception','URL Photo Étiquette','URL Dossier Drive']);
    mkSheet('DDM',['N Lot','Recette','Format','Date production','DDM mois','Date limite','Statut','Localisation','Notes'],3);
    mkSheet('Ventes',['Date','N° Facture','Canal','Client','Recette','Gamme','Format Weck','Qte','PU HT EUR','Remise %','Net HT EUR','TVA EUR','TTC EUR','Notes'],4);
    mkSheet('Avoirs',['Date','N° Avoir','Type','Client','Recette','Gamme','Format','Qte','PU HT','Remise %','Net HT','TVA EUR','TTC EUR','Motif'],4);
    mkSheet('Clients',['ID','Prénom','Nom','Email','Téléphone','Adresse','Département','Canal','Statut Ulule','Vote recette','Nb achats','CA total','Type','Notes'],2);
    mkSheet('Marches',['Date marche','Lieu','Météo','Prévision CA','CA réel','Écart','%','Notes'],3);
    mkSheet('Bons de Commande',['N° BC','Date','Client','Type client','Adresse livraison','Recette 1','Format 1','Qté 1','PU HT 1','Recette 2','Format 2','Qté 2','PU HT 2','Recette 3','Format 3','Qté 3','PU HT 3','Remise %','Franco port','Total HT EUR','TVA EUR','TTC EUR','Statut','Date livraison','Délai paiement','Notes conditions'],4);
    mkSheet('Réclamations',['N° REC','Date récept.','Client','Contact','N° Lot','Recette','Nature','Gravité','Description','Action','Échéance réponse','Date réponse','Statut','Notes'],3);
    mkSheet('Compta',['Date','Type','Catégorie','Description','Montant HT','TVA %','TVA EUR','TTC EUR','Mode paiement','Réf'],3);
    mkSheet('Charges',['Poste','Type','Estimation','Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc','Total'],3);
    mkSheet('Previsionnel',['Mois','CA Previsionnel','CA Reel','Charges Prevues','Charges Reelles','Tréso Prév','Tréso Réelle','Écart'],3);
    mkSheet('Prix Vente',['Gamme','Format Weck','B TO C MARCHES (TTC)','B2C x3 (TTC)','B2C x6 (TTC)','B2C x20 (TTC)','Ecom x1','Ecom x3','Ecom x6','Restaurants x3 HT','Restaurants x6 HT','Restaurants x20 HT','Epiceries x6 HT','Epiceries x20 HT'],4);
    mkSheet('Plan Nettoyage',['Zone','Fréquence','Produit','Méthode','Responsable','Sem1','Sem2','Sem3','Sem4'],3);
    mkSheet('DUERP',['Unité travail','Risque identifié','Probabilité (1-3)','Gravité (1-3)','Score','Niveau','Action corrective','Responsable','Délai','Statut'],3);
    mkSheet('Parc Machine',['ID','Nom','Type','Cap_RR290','Cap_RR580','Cap_RR850','Cap_W050','Cap_W080','Debit_kg_h','Conso_kW','Statut','Notes']);
    mkSheet('CE & Associations',['N° CE','Organisme','Contact','Email','Date','Détail lignes','Lignes JSON','Total bocaux','Total HT','Remise %','Net HT','Statut'],3);
    mkSheet('Assistant Decisions',['Catégorie','Recommandation','Impact','Priorité'],3);
    mkSheet('Assistant Production',['Recette','Statut','Priorité','Commentaire'],3);

    // Initialise aussi les clés Config manquantes
    initConfigDefaults();

    Logger.log('setupSpreadsheet: '+created.length+' feuille(s) créée(s)');
    return{success:true,created:created,total:created.length};
  }catch(e){Logger.log('setupSpreadsheet:'+e.message);return{success:false,error:e.message};}
}

// ─── HASH PIN MIGRATION ───────────────────────────────────────────────────
// Appeler une fois pour hacher tous les PINs en clair dans Utilisateurs.
// Après migration, les PINs en clair ne fonctionneront plus.
function migratePinsToHash(){
  try{
    var sh=SS().getSheetByName('Utilisateurs');
    if(!sh) return{success:false,error:'Feuille Utilisateurs introuvable'};
    var d=sh.getDataRange().getValues();
    var h=d[0].map(function(x){return String(x).trim();});
    var ip=h.indexOf('PIN');
    if(ip<0) return{success:false,error:'Colonne PIN introuvable'};
    var count=0;
    for(var i=1;i<d.length;i++){
      var raw=String(d[i][ip]).trim().replace(/\.0+$/,'');
      if(!raw||raw.length===64) continue; // déjà hashé ou vide
      var hashed=hashPin(raw);
      sh.getRange(i+1,ip+1).setValue(hashed);
      count++;
    }
    Logger.log('migratePinsToHash: '+count+' PIN(s) hachés');
    return{success:true,migrated:count};
  }catch(e){return{success:false,error:e.message};}
}

// ─── SIGNATURE ÉLECTRONIQUE CCP1 ──────────────────────────────────────────
// Valide un lot avec confirmation de l'identité par PIN.
// Retourne { success, user: {nom, role}, ts } si PIN correct.
// Côté HTML : appeler checkLoginForSignature(pin) AVANT saveFicheLotStatus.
function checkLoginForSignature(pin){
  try{
    var user=checkLogin(pin);
    if(!user) return{success:false,error:'PIN incorrect'};
    var ts=Utilities.formatDate(new Date(),'Europe/Paris','yyyy-MM-dd HH:mm:ss');
    _writeAudit(user,'signature_CCP1','Confirmation identité pour validation lot — '+ts);
    return{success:true,user:{nom:user['Nom']||user.Nom||'',role:user['Rôle']||user['Role']||''},ts:ts};
  }catch(e){Logger.log('checkLoginForSignature: '+e.message);return{success:false,error:e.message};}
}