/* =====================================================================
   shindan_core.js ── 日本酒三角チャート診断の「計算ロジック」本体
   =====================================================================
   v11.25（2026-08-18）で index.html から分離。将来のWebMCP対応の下ごしらえ。

   ■ 役割分担（元栓ルール）
   - データ（QUESTIONS・TYPES・LV・STORE_SAKE・NATL_SAKE）は今までどおり
     index.html 側にある。銘柄座標の元栓は 00_永久設定/sake_data/ のNumbers正本。
     このファイルは「計算」だけを持ち、データは引数で受け取る（中に持たない）。
   - つまり sake-master-sync（座標マスター反映）の手順は従来どおり index.html を直す。

   ■ 使い方（画面から）
     result = ShindanCore.computeResult(answers, {QUESTIONS,TYPES,LV,STORE_SAKE,NATL_SAKE});
   ■ 使い方（画面なし・WebMCP/検証用）
     out = ShindanCore.run([0,1,2,3,0,1,2,3,0,1], {QUESTIONS,TYPES,LV,STORE_SAKE,NATL_SAKE});
     （選択肢番号は0はじまり。詳しくはリポジトリREADMEの「診断ロジックAPI」節）

   ■ 移植の約束
   - v11.24 の挙動を一切変えない「そのまま移し」。式・順序・丸め・同点処理まで同一。
   - 既知の温存事項：computeResult 内の legacySeed（旧seed）は、元コードの
     opts.indexOf(a) が回答の包みオブジェクトを探すため常に -1 → seed は常に 0。
     家飲み☆◎◇の完全同点の振り分けに使われる値だが、挙動維持のため意図的に温存
     （2026-08-18 報告済み。直すときは橋野さんの判断で別途）。
   ===================================================================== */
(function(root){
"use strict";

/* 正規化の分母（合計点→0〜10座標） */
var DIV = { x:10, y:10, z:10 };

/* v11.22 店内3本の選び方
   1本目：診断座標から3次元距離が最も近い1本。
   2・3本目：1本目が代表する軸以外の2頂点へ向かう銘柄を分け、
              それぞれの方向グループ内で診断座標に最も近い1本。
   結果の最大軸が同点のときは、1本目の銘柄で最も強い軸を代表軸にする。 */
var TASTE_AXES=["x","y","z"];
var TASTE_VERTICES={x:{x:10,y:0,z:0},y:{x:0,y:10,z:0},z:{x:0,y:0,z:10}};
/* Lunaの10回試験を受け、ラベルに十分な方向性がある候補を先に選ぶ。
   cos=0.5 は頂点方向との角度60度以内。候補がなければ従来どおり距離優先へ戻す。 */
var DIRECTION_COS_MIN=0.5;

function answerSeed(answers){
  var n=0;
  answers.forEach(function(a){var oi=Number(a&&a.oi)||1;n=n*4+Math.max(0,oi-1);});
  return n;
}
function strongestAxis(v,seed){
  var max=Math.max(v.x,v.y,v.z);
  var ties=TASTE_AXES.filter(function(k){return v[k]===max;});
  return ties[(seed||0)%ties.length];
}
function directionCosine(sc,b,axis){
  var vertex=TASTE_VERTICES[axis];
  var a={x:b.x-sc.x,y:b.y-sc.y,z:b.z-sc.z};
  var v={x:vertex.x-sc.x,y:vertex.y-sc.y,z:vertex.z-sc.z};
  var al=Math.hypot(a.x,a.y,a.z),vl=Math.hypot(v.x,v.y,v.z);
  if(al===0||vl===0)return 0;
  return (a.x*v.x+a.y*v.y+a.z*v.z)/(al*vl);
}
function selectStoreRecommendations(sc,ranked,seed){
  var nearest=ranked[0];
  var scoreMax=Math.max(sc.x,sc.y,sc.z);
  var scoreTies=TASTE_AXES.filter(function(k){return sc[k]===scoreMax;});
  var baseAxis=scoreTies.length===1?scoreTies[0]:strongestAxis(nearest,seed);
  var targetAxes=TASTE_AXES.filter(function(k){return k!==baseAxis;});
  var pool=ranked.slice(1).map(function(b,order){
    var cos={};targetAxes.forEach(function(k){cos[k]=directionCosine(sc,b,k);});
    var target=targetAxes[0];
    if(cos[targetAxes[1]]>cos[targetAxes[0]])target=targetAxes[1];
    return {b:b,order:order,cos:cos,target:target};
  });
  var used=new Set([nearest.name]);
  var picks=[Object.assign({},nearest,{recKind:"nearest",recAxis:baseAxis})];
  targetAxes.forEach(function(axis){
    var available=pool.filter(function(c){return !used.has(c.b.name);});
    var cands=available.filter(function(c){return c.target===axis&&c.cos[axis]>=DIRECTION_COS_MIN;});
    if(!cands.length)cands=available.filter(function(c){return c.cos[axis]>=DIRECTION_COS_MIN;});
    if(!cands.length)cands=available.filter(function(c){return c.target===axis&&c.cos[axis]>0;});
    if(!cands.length)cands=available.filter(function(c){return c.cos[axis]>0;});
    if(!cands.length)cands=available.slice();
    cands.sort(function(a,b){
      if(a.b.d!==b.b.d)return a.b.d-b.b.d;
      if(a.cos[axis]!==b.cos[axis])return b.cos[axis]-a.cos[axis];
      return a.order-b.order;
    });
    var chosen=cands[0];
    if(!chosen)return;
    used.add(chosen.b.name);
    picks.push(Object.assign({},chosen.b,{recKind:"direction",recAxis:axis,recCos:chosen.cos[axis]}));
  });
  return picks;
}

/* 診断の本体：回答一式＋データ一式 → 結果オブジェクト（v11.24のcompute()と同一の中身を返す）
   answers＝[{sc:{x,y,z}, oi:1〜4}] × 10問（画面のchoose()が作る形そのまま）
   data＝{QUESTIONS,TYPES,LV,STORE_SAKE,NATL_SAKE} */
function computeResult(answers,data){
  var QUESTIONS=data.QUESTIONS,TYPES=data.TYPES,LV=data.LV,STORE_SAKE=data.STORE_SAKE;
  var s={x:0,y:0,z:0};
  answers.forEach(function(a){
    if(!a.sc) return;
    s.x+=a.sc.x||0; s.y+=a.sc.y||0; s.z+=a.sc.z||0;
  });
  /* 嫌い減点後の下限0 */
  s.x=Math.max(0,s.x); s.y=Math.max(0,s.y); s.z=Math.max(0,s.z);
  /* 正規化：0〜10座標（上限10） */
  var sc={
    x:Math.min(10,Math.round(s.x/DIV.x*10)),
    y:Math.min(10,Math.round(s.y/DIV.y*10)),
    z:Math.min(10,Math.round(s.z/DIV.z*10))
  };
  if(sc.x+sc.y+sc.z===0) sc={x:2,y:2,z:2};
  /* 27タイプ判定（低1.5/中5/高8.5の代表座標に最近傍） */
  var type=TYPES[0],best=1e9;
  TYPES.forEach(function(t){
    var d=Math.pow(LV[t.lv[0]]-sc.x,2)+Math.pow(LV[t.lv[1]]-sc.y,2)+Math.pow(LV[t.lv[2]]-sc.z,2);
    if(d<best){best=d;type=t;}
  });
  /* 店の銘柄ランキング（店内銘柄のみ）。
     ユーザー座標 (sc.x, sc.y, sc.z) と各銘柄の3次元ユークリッド距離を計算し、近い順に並べる。
     チャート描画も同じ ranked を使うので、表示位置とランキングが一致する。 */
  var ranked=STORE_SAKE.map(function(b,storeOrder){
    return Object.assign({},b,{storeOrder:storeOrder,
      d:Math.sqrt(Math.pow(b.x-sc.x,2)+Math.pow(b.y-sc.y,2)+Math.pow(b.z-sc.z,2))});
  }).sort(function(a,b){return a.d-b.d||a.storeOrder-b.storeOrder;});
  var directionSeed=answerSeed(answers);
  var recStore=selectStoreRecommendations(sc,ranked,directionSeed);
  /* 同点銘柄の振り分け用シード：回答の組み合わせ番号（同じ回答→同じ値。ランダムは使わない）
     ※挙動温存：opts.indexOf(a)は回答の包みを探すため常に-1→seedは常に0（ファイル冒頭の注記参照） */
  var seed=0;
  answers.forEach(function(a,i){
    var oi=QUESTIONS[i]?QUESTIONS[i].opts.indexOf(a):-1;
    seed=seed*4+(oi>0?oi:0);
  });
  return {X:sc.x,Y:sc.y,Z:sc.z,type:type,ranked:ranked,recStore:recStore,orderPhrase:type.orderPhrase,seed:seed,directionSeed:directionSeed};
}

/* シェア文用：全国銘柄から近い順に2本（店内おすすめと同名は飛ばす） */
function natlTop2(r,exclude,NATL_SAKE){
  var ex=exclude||[];
  return NATL_SAKE.filter(function(b){return ex.indexOf(b.name)<0;})
    .map(function(b){return {b:b,d:(b.x-r.X)*(b.x-r.X)+(b.y-r.Y)*(b.y-r.Y)+(b.z-r.Z)*(b.z-r.Z)};})
    .sort(function(p,q){return p.d-q.d;}).slice(0,2).map(function(p){return p.b;});
}

/* 家飲み候補：☆◎◇から診断座標に最も近い1本ずつ。店内おすすめとの重複は避ける */
function homeTop3(r,exclude,NATL_SAKE){
  var ex=exclude||[];
  return ["☆","◎","◇"].map(function(mark){
    var cands=NATL_SAKE.filter(function(b){return b.mark===mark&&ex.indexOf(b.name)<0;})
      .map(function(b){return {b:b,d:(b.x-r.X)*(b.x-r.X)+(b.y-r.Y)*(b.y-r.Y)+(b.z-r.Z)*(b.z-r.Z)};});
    if(!cands.length)return null;
    var min=Infinity;cands.forEach(function(c){if(c.d<min)min=c.d;});
    var ties=cands.filter(function(c){return c.d===min;});
    /* 完全同点は回答由来のシードで振り分け：同じ回答なら同じ1本（v11.8） */
    return ties[(r.seed||0)%ties.length].b;
  }).filter(Boolean);
}

/* =====================================================================
   run() ── 画面なしで診断を1回まわす入口（WebMCP・検証・他アプリ用）
   入力：answerIndices＝選択肢番号（0はじまり）を質問順に10個並べた配列
   出力：JSONにそのまま変換できる結果（入出力仕様はREADMEの「診断ロジックAPI」節）
   ===================================================================== */
function run(answerIndices,data){
  var QUESTIONS=data.QUESTIONS;
  if(!Array.isArray(answerIndices)||answerIndices.length!==QUESTIONS.length){
    throw new Error("answers must be an array of "+QUESTIONS.length+" option indexes (0-based)");
  }
  var answers=answerIndices.map(function(oi,i){
    var q=QUESTIONS[i];
    if(!q.opts[oi]) throw new Error("question "+(i+1)+": option index "+oi+" is out of range");
    return {sc:q.opts[oi].sc,oi:oi+1};   /* 画面のchoose()と同じ形 */
  });
  var r=computeResult(answers,data);
  var home=homeTop3(r,r.recStore.map(function(b){return b.name;}),data.NATL_SAKE);
  var ex=(data.TYPE_EXTRA||{})[r.type.no]||{};
  var taste=(data.TASTE_MESSAGE||{})[r.type.no]||"";
  return {
    scores:{sukkiri:r.X,fruity:r.Y,shikkari:r.Z},
    type:{
      no:r.type.no,
      name:r.type.name,
      catName:ex.cat||"",
      oneLiner:r.type.oneLiner||"",
      tasteMessage:taste,
      orderPhrase:r.type.orderPhrase||"",
      pairing:r.type.pairing||[],
      catImage:r.type.catImage||""
    },
    storeRecommendations:r.recStore.map(function(b){
      return {name:b.name,mark:b.mark,comment:b.comment||"",distance:Math.round(b.d*100)/100,kind:b.recKind,axis:b.recAxis};
    }),
    homeRecommendations:home.map(function(b){
      return {name:b.name,mark:b.mark,x:b.x,y:b.y,z:b.z};
    }),
    rankedStore:r.ranked.map(function(b){return b.name;}),
    seeds:{seed:r.seed,directionSeed:r.directionSeed}
  };
}

var api={
  answerSeed:answerSeed,
  strongestAxis:strongestAxis,
  directionCosine:directionCosine,
  selectStoreRecommendations:selectStoreRecommendations,
  computeResult:computeResult,
  natlTop2:natlTop2,
  homeTop3:homeTop3,
  run:run
};
root.ShindanCore=api;
if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
