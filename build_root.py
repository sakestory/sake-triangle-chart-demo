# sitenew/index.html（下書き原本）から、本番トップ用の index.html を生成する。
# 原本は下書きのまま（noindex付き）を維持し、本番向けの差分はここで一元管理する。
import sys

src = open("sitenew/index.html", encoding="utf-8").read()
t = src

def must_replace(old, new):
    global t
    if old not in t:
        print(f"ERROR: 置換元が見つからない: {old[:40]}...", file=sys.stderr)
        sys.exit(1)
    t = t.replace(old, new)

# ① 検索用タイトルを本番仕様に（「日本酒酒場」へ言葉替え）
must_replace(
    "<title>SAKE story — 旅するように、日本酒を。（プレビュー版）</title>",
    "<title>五反田 日本酒酒場 SAKE story｜Mr.SAKE店主が厳選した地酒専門店</title>",
)

# ② noindex を外し、canonical を宣言
must_replace(
    '<meta name="robots" content="noindex,nofollow">',
    '<link rel="canonical" href="https://sake-story.com/">',
)

# ③ 検索用説明文を本番仕様に（希少銘柄キーワード入り）
must_replace(
    '<meta name="description" content="東京・五反田、少し大人の為の日本酒酒場 SAKE story。初代Mr.SAKEグランプリの店主が、日本各地の日本酒と地域の肴を一杯ずつご案内。店主考案の「日本酒三角チャート」で好みの一杯が見つかります。JR五反田駅 西口徒歩4分。">',
    '<meta name="description" content="五反田の日本酒酒場「SAKE story」は、Mr.SAKEグランプリ受賞の店主が厳選した日本酒専門店。十四代・鍋島・新政など希少銘柄と郷土料理のペアリング。店主考案の「日本酒三角チャート」診断で好みの一杯が見つかります。JR五反田駅 西口徒歩4分。">',
)

# ④ Googleアナリティクス（現行トップと同じ3つのID）をフォント読み込みの前に挿入
#    ※目印はページ内に1か所しかない完全な行を使う（2重挿入事故の防止）
anchor = '<link rel="preconnect" href="https://fonts.googleapis.com">'
ga = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-NK2MW06S5P"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-NK2MW06S5P');
gtag('config', 'GT-TWZ9QN7H');
gtag('config', 'G-98BQ8NC620');
</script>
""" + anchor
assert src.count(anchor) == 1, "GA挿入の目印が1か所ではない"
must_replace(anchor, ga)

# ⑤ 下書き表記を削除
must_replace('<div class="sample-tag">PREVIEW v3.6 — 下書き・検索対象外</div>\n', "")
must_replace(
    "<span>DESIGN SAMPLE v3.6 — NOT PUBLISHED</span>",
    "<span>GOTANDA, TOKYO</span>",
)

# 検算
assert "noindex" not in t, "noindexが残っている"
assert t.count("gtag('config'") == 3, "GA設定が3本ない"
assert "PREVIEW" not in t and "DESIGN SAMPLE" not in t, "下書き表記が残っている"
assert 'rel="canonical"' in t, "canonicalが無い"

import os, shutil
os.makedirs("deploy", exist_ok=True)
open("deploy/index.html", "w", encoding="utf-8").write(t)
print("本番用 index.html を生成（全5点の変換と検算に合格）")

# --- 画像アセット：加工不要のためそのままコピー ---
if os.path.isdir("sitenew/assets"):
    shutil.copytree("sitenew/assets", "deploy/assets", dirs_exist_ok=True)
    print("assets/ をそのままコピー")

# --- 言語版・接待ページ：noindexを外して本番化 ---
for sub in ["en", "zh-cn", "business"]:
    p = f"sitenew/{sub}/index.html"
    s = open(p, encoding="utf-8").read()
    old = '<meta name="robots" content="noindex,nofollow">'
    assert old in s, f"{sub}: noindex行が見つからない"
    s = s.replace(old, "")
    assert "noindex" not in s, f"{sub}: noindexが残っている"
    os.makedirs(f"deploy/{sub}", exist_ok=True)
    open(f"deploy/{sub}/index.html", "w", encoding="utf-8").write(s)
    print(f"本番用 {sub}/index.html を生成（noindex解除）")
