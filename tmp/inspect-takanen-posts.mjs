const ids = {
  anniversary: 4320,
  takafes5: 4250,
  seoul: 4180,
  honey: 4160,
  bouquet_stamp: 4500,
  endyear: 4550,
};

async function show(id, label) {
  const p = await (await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts/${id}`)).json();
  if (p.code) {
    console.log(`\n== ${label} id=${id} NOT FOUND ==`);
    return;
  }
  console.log(`\n== ${label} ==`);
  console.log(p.title?.rendered?.replace(/<[^>]+>/g, ""));
  const lines = p.content.rendered
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines) {
    if (/日|会場|日程|公演|開催|venue/i.test(l)) console.log(" ", l.slice(0, 140));
  }
}

// discover ids by search
const searches = [
  ["anniversary", "3rd ANNIVERSARY CONCERT 「A Wonderful Encounter」"],
  ["takafes5", "たかねこフェスVol.5"],
  ["seoul", "初のソウルワンマン"],
  ["honey", "ハニフェス 2025 ～女子校文化祭 日比谷"],
  ["bouquet", "Live Tour – Bouquet of 9 Flowers – 開催決定"],
  ["endyear", "年末大感謝祭2025 開催"],
  ["spring", "東名阪ツアー 2025"],
];

for (const [label, q] of searches) {
  const ps = await (
    await fetch(
      `https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=5`,
    )
  ).json();
  const hit = ps.find((p) => !/詳細|当日販売|返金|くじ|スタンプ|キャンペーン|シェア|引換|更新/.test(p.title?.rendered ?? ""));
  if (hit) await show(hit.id, `${label} (${hit.id})`);
  else console.log(`\n== ${label} no clean hit ==`, ps[0]?.title?.rendered?.slice(0, 80));
}
