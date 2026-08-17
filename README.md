# Sake Triangle Chart Diagnosis (Demo)

An interactive tool that maps Japanese sake across three flavor axes — **Clean (すっきり)**, **Fruity (フルーティー)**, and **Rich (しっかり)** — helping you get closer to a bottle you'll love by ruling out flavors you dislike.

**Live demo:** https://sakestory.github.io/sake-triangle-chart-demo/

## Concept

When choosing sake, saying "something dry" or "something easy to drink" often still leads to a bottle that doesn't match your taste. Instead of only searching for flavors you like, this diagnosis visualizes your direction by ruling out the flavors you dislike.

## The Three Axes

- **Clean / すっきり**
- **Fruity / フルーティー**
- **Rich / しっかり**

Your result is plotted as a balance of these three axes on a triangle chart.

## Languages

Available in 5 languages — switch anytime from the dropdown in the top right corner:

- 日本語 (Japanese)
- English
- 中文（简体字）Chinese (Simplified)
- 中文（繁體字）Chinese (Traditional)
- 한국어 (Korean)

## About This Repository

This is a public **demo** version. Store-specific brand selection, question design, result copy, onboarding support, staff training, and commercial use are all offered as individual customizations.

## Trademark & Brand

Commercial use of the "Sake Triangle Chart" ("日本酒三角チャート") name, logo, and related brand expressions requires permission from the rights holder. The terms for using the code and the terms for using the name/brand are handled separately.

---

# 日本酒三角チャート診断 デモ版

日本酒三角チャート診断は、日本酒を「すっきり・フルーティー・しっかり」の3軸で整理し、苦手な味わいを外しながら、自分に合う一杯に近づくための診断ツールです。

**デモを試す:** https://sakestory.github.io/sake-triangle-chart-demo/

## コンセプト

日本酒を選ぶとき、「辛口で」「飲みやすいもので」と伝えても、実際には好みと違う一杯が出てくることがあります。

この診断では、好きな味を探すだけでなく、苦手な味を外すことで、自分に合う日本酒の方向性を見える化します。

## 3つの軸

- すっきり
- フルーティー
- しっかり

診断結果は、この3軸のバランスとして三角チャート上に表示されます。

## 対応言語

**5言語対応。**画面右上のプルダウンから、いつでも切り替えられます。

- 日本語
- English（英語）
- 中文（简体字）／中国語（簡体字）
- 中文（繁體字）／中国語（繁体字）
- 한국어／韓国語

## このリポジトリについて

このリポジトリは、公開用のデモ版です。

店舗別の銘柄設計、質問設計、結果コピー、導入支援、スタッフ教育、商用利用については、個別のカスタマイズを前提としています。

## 商標・ブランドについて

「日本酒三角チャート」および関連する名称・ロゴ・ブランド表現の商用利用には、権利者の許可が必要です。

コードの利用条件と、名称・ブランドの利用条件は別に扱います。

## 診断ロジックAPI（shindan_core.js）── v11.25で分離・WebMCP対応の下ごしらえ

2026-08-18（v11.25）から、診断の「計算」本体は `shindan_core.js` にあります。画面（index.html）と切り離して、関数として単独で呼べます。挙動はv11.24と完全に同一（全1,048,576通りの回答で新旧一致を機械照合済み）。

### 役割分担

- **shindan_core.js** … 計算だけ。データは一切持たない（引数で受け取る）
- **index.html** … データ（質問・27タイプ・銘柄座標）と画面。銘柄座標の元栓は従来どおり `00_永久設定/sake_data/` のNumbers正本 → index.html へ反映（`sake-master-sync` の手順は不変）

### 何を渡すと、何が返るか

**入力**＝選択肢番号（0はじまり）を質問順に10個並べた配列と、データ一式。

```js
// 画面の中では shindanData() がデータ一式を渡す
const out = ShindanCore.run([0,1,3,0,1,2,1,2,1,2], shindanData());
```

**出力**＝そのままJSONにできる結果（例は実際の出力）：

```json
{
  "scores": { "sukkiri": 5, "fruity": 7, "shikkari": 2 },
  "type": {
    "no": 11,
    "name": "甘い顔、潔い後味",
    "catName": "童顔切れ者猫",
    "oneLiner": "土壇場で一番冷静な人",
    "tasteMessage": "華やかな香りは好き。でも後味はきれいに切れてほしい。…",
    "orderPhrase": "華やかだけど、後味はすっきりした日本酒をお願いします",
    "pairing": ["カルパッチョ", "白和え", "フルーツ×チーズ"],
    "catImage": "cat_11.png"
  },
  "storeRecommendations": [
    { "name": "十四代", "mark": "☆", "comment": "…", "distance": 1, "kind": "nearest", "axis": "y" },
    { "name": "天賦", "mark": "☆", "comment": "…", "distance": 1.41, "kind": "direction", "axis": "x" },
    { "name": "磐城壽夏酒", "mark": "◎", "comment": "…", "distance": 1.41, "kind": "direction", "axis": "z" }
  ],
  "homeRecommendations": [
    { "name": "寫樂", "mark": "☆", "x": 4, "y": 7, "z": 2 },
    { "name": "赤武", "mark": "◎", "x": 5, "y": 7, "z": 2 },
    { "name": "菊正宗銀パック", "mark": "◇", "x": 6, "y": 7, "z": 1 }
  ],
  "rankedStore": ["十四代", "天賦", "磐城壽夏酒", "…（店内全銘柄・近い順）"],
  "seeds": { "seed": 0, "directionSeed": 116326 }
}
```

- `scores` … 3軸の点数（各0〜10）。sukkiri=すっきり／fruity=フルーティー／shikkari=しっかり
- `type` … 27タイプのうち1つ（no=1〜27）
- `storeRecommendations` … 店内おすすめ3本（1本目=最近傍、2・3本目=別の頂点方向へ広がる2本。マークは店内銘柄の入手区分で、画面の店内欄には表示しない）
- `homeRecommendations` … 家飲み候補 ☆◎◇ 各1本（店内3本と重複しない）
- `rankedStore` … 店内全銘柄を近い順に並べたもの
- `seeds` … 同点振り分け用の内部値（デバッグ用）

### 画面を通さず動かす（Node・検証・将来のWebMCP）

`shindan_core.js` はブラウザでもNodeでも読める。データ一式（QUESTIONS/TYPES/LV/STORE_SAKE/NATL_SAKE、任意でTYPE_EXTRA/TASTE_MESSAGE）を index.html から取り出して渡せば、画面なしで診断が1回まわる。将来WebMCPのツールとして公開する場合は、`run()` をそのままツールの実体にできる。

### 改修時の注意

- ロジックを直すときは `shindan_core.js` を直し、**index.html 側の `?v=` クエリ（`shindan_core.js?v=11.25`）も新しい版に上げる**（ブラウザに古いキャッシュが残るのを防ぐため）
- データ・文言・画面を直すときは従来どおり index.html
- デプロイのファイル数チェックは68（shindan_core.js追加で67→68に更新済み）
