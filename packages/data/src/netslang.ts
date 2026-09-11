import type { WordEntry } from './types.ts';

/**
 * 網路用語 (owner request, 2026-09-11): the words young people actually type in chat and on
 * social media. 60 entries — the evergreen ones plus the 2025–2026 crop collected from public
 * "若者言葉・流行語" round-ups on 2026-09-11 (weknowledge.jp, oscar-formen.com, omcha.jp);
 * meanings shift fast, treat this as a snapshot. `kana` is the typed target (the way the word
 * is typed), `kanji` the written form when there is one, `zh` a short 繁體中文 gloss.
 */
export const NETSLANG: readonly WordEntry[] = [
	// ── 2025–2026 ──────────────────────────────────────────────────────────────
	{ kana: 'すきすぎてめつ', kanji: '好きすぎて滅', zh: '太喜歡了要滅亡了（喜歡到極點）' },
	{ kana: 'メロい', zh: '迷人到令人融化（メロメロ）' },
	{ kana: 'ギュン', zh: '比キュン更強烈的心動' },
	{ kana: 'かいわい', kanji: '界隈', zh: '「〇〇界隈」＝某個圈子、同好社群' },
	{ kana: 'きちゃー', zh: '來了！（期待的場面出現）' },
	{ kana: 'ピキる', zh: '氣到青筋暴起' },
	{ kana: 'しゃばい', zh: '遜、無聊、不怎麼樣' },
	{ kana: 'うまかく', kanji: 'うま確', zh: '確定好吃（うますぎ確定）' },
	{ kana: 'フレネミー', zh: '表面朋友實則敵人' },
	{ kana: 'げんかいオタク', kanji: '限界オタク', zh: '愛到失控的粉絲' },
	{ kana: 'かえるかげんしょう', kanji: '蛙化現象', zh: '對方喜歡自己後反而反感的現象' },
	{ kana: 'かわちぃ', zh: '可愛（かわいい的可愛講法）' },
	{ kana: 'なぁぜなぁぜ', zh: '為什麼呢為什麼呢（撒嬌式質問）' },
	{ kana: 'しかかたん', kanji: 'しか勝たん', zh: '「〇〇しか勝たん」＝只有〇〇最棒' },
	{ kana: 'チルする', zh: '放鬆、耍廢' },
	{ kana: 'エッホエッホ', zh: '（貓頭鷹跑步梗）我來了、衝啊' },
	{ kana: 'ちゅき', zh: '喜歡（撒嬌版的好き）' },
	{ kana: 'かみってる', kanji: '神ってる', zh: '神級表現、超神' },
	{ kana: 'むりゲー', kanji: '無理ゲー', zh: '根本破不了關、不可能的任務' },
	{ kana: 'テンアゲ', zh: '情緒高漲（テンション上げ）' },
	{ kana: 'そくおち', kanji: '即落ち', zh: '秒淪陷、立刻被圈粉' },
	{ kana: 'ビジュいい', zh: '顏值高（ビジュアルがいい）' },
	// ── 定番 ───────────────────────────────────────────────────────────────────
	{ kana: 'くさ', kanji: '草', zh: '笑（超好笑，來自 w）' },
	{ kana: 'やばい', zh: '糟糕／超讚（萬用）' },
	{ kana: 'えぐい', zh: '太狠、太誇張、超厲害' },
	{ kana: 'エモい', zh: '很有感覺、觸動情緒' },
	{ kana: 'それな', zh: '就是說啊' },
	{ kana: 'りょ', kanji: '了', zh: '了解（縮寫）' },
	{ kana: 'おつ', kanji: '乙', zh: '辛苦了（縮寫）' },
	{ kana: 'がち', zh: '認真、真的' },
	{ kana: 'まじ', zh: '真的假的、認真的' },
	{ kana: 'ぴえん', zh: '嗚嗚（撒嬌式哭）' },
	{ kana: 'ワンチャン', zh: '說不定有機會' },
	{ kana: 'ばえる', kanji: '映える', zh: '上鏡、好拍' },
	{ kana: 'とりま', zh: '總之先' },
	{ kana: 'ググる', zh: '用 Google 查' },
	{ kana: 'リアじゅう', kanji: 'リア充', zh: '現實生活充實的人' },
	{ kana: 'ぼっち', zh: '一個人、邊緣人' },
	{ kana: 'おし', kanji: '推し', zh: '本命、最愛的偶像' },
	{ kana: 'おしかつ', kanji: '推し活', zh: '追星活動' },
	{ kana: 'ぬま', kanji: '沼', zh: '入坑、深陷' },
	{ kana: 'しんどい', zh: '好累、受不了（也可指萌到受不了）' },
	{ kana: 'てぇてぇ', zh: '尊、太美好了' },
	{ kana: 'わかりみ', zh: '懂、有同感' },
	{ kana: 'つらみ', zh: '好痛苦' },
	{ kana: 'きゅんです', zh: '心動了' },
	{ kana: 'ちな', zh: '順帶一提（縮寫）' },
	{ kana: 'おけ', zh: 'OK' },
	{ kana: 'あざす', zh: '謝啦' },
	{ kana: 'うける', zh: '好好笑' },
	{ kana: 'だるい', zh: '懶、提不起勁' },
	{ kana: 'めんどい', zh: '麻煩' },
	{ kana: 'きもい', zh: '噁心' },
	{ kana: 'うざい', zh: '煩人' },
	{ kana: 'ぱない', zh: '超厲害（半端ない）' },
	{ kana: 'ディスる', zh: '嘲諷、貶低' },
	{ kana: 'バズる', zh: '爆紅' },
	{ kana: 'ポチる', zh: '下單（按購買鍵）' },
	{ kana: 'エゴサ', zh: '搜尋自己的名字' },
	{ kana: 'そくレス', kanji: '即レス', zh: '秒回' }
];
