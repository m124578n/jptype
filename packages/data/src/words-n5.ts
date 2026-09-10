import type { WordEntry } from './types.ts';

/**
 * JLPT N5 vocabulary (spec §7.1 item 8). 100 entries, written from scratch:
 * `kana` is the reading (hiragana, katakana for loanwords) and is the typed target,
 * `kanji` the usual written form when it differs, `zh` a short 繁體中文 gloss.
 * Readings use only kana from the table plus ー and っ, so every entry tokenizes.
 */
export const WORDS_N5: readonly WordEntry[] = [
	// ── 人 ────────────────────────────────────────────────────────────────────
	{ kana: 'わたし', kanji: '私', zh: '我' },
	{ kana: 'あなた', zh: '你' },
	{ kana: 'ひと', kanji: '人', zh: '人' },
	{ kana: 'おとこ', kanji: '男', zh: '男人' },
	{ kana: 'おんな', kanji: '女', zh: '女人' },
	{ kana: 'こども', kanji: '子供', zh: '小孩' },
	{ kana: 'がくせい', kanji: '学生', zh: '學生' },
	{ kana: 'せんせい', kanji: '先生', zh: '老師' },
	{ kana: 'いしゃ', kanji: '医者', zh: '醫生' },
	{ kana: 'かいしゃいん', kanji: '会社員', zh: '公司職員' },
	{ kana: 'ともだち', kanji: '友達', zh: '朋友' },
	{ kana: 'かぞく', kanji: '家族', zh: '家人' },
	{ kana: 'ちち', kanji: '父', zh: '（自己的）父親' },
	{ kana: 'はは', kanji: '母', zh: '（自己的）母親' },
	{ kana: 'あに', kanji: '兄', zh: '哥哥' },
	{ kana: 'あね', kanji: '姉', zh: '姊姊' },
	{ kana: 'おとうと', kanji: '弟', zh: '弟弟' },
	{ kana: 'いもうと', kanji: '妹', zh: '妹妹' },
	{ kana: 'なまえ', kanji: '名前', zh: '名字' },

	// ── 場所 ──────────────────────────────────────────────────────────────────
	{ kana: 'がっこう', kanji: '学校', zh: '學校' },
	{ kana: 'だいがく', kanji: '大学', zh: '大學' },
	{ kana: 'かいしゃ', kanji: '会社', zh: '公司' },
	{ kana: 'えき', kanji: '駅', zh: '車站' },
	{ kana: 'びょういん', kanji: '病院', zh: '醫院' },
	{ kana: 'ぎんこう', kanji: '銀行', zh: '銀行' },
	{ kana: 'ゆうびんきょく', kanji: '郵便局', zh: '郵局' },
	{ kana: 'みせ', kanji: '店', zh: '商店' },
	{ kana: 'いえ', kanji: '家', zh: '家' },
	{ kana: 'へや', kanji: '部屋', zh: '房間' },
	{ kana: 'レストラン', zh: '餐廳' },

	// ── 物 ────────────────────────────────────────────────────────────────────
	{ kana: 'ドア', zh: '門' },
	{ kana: 'つくえ', kanji: '机', zh: '書桌' },
	{ kana: 'ほん', kanji: '本', zh: '書' },
	{ kana: 'えんぴつ', kanji: '鉛筆', zh: '鉛筆' },
	{ kana: 'かばん', kanji: '鞄', zh: '包包' },
	{ kana: 'とけい', kanji: '時計', zh: '時鐘、手錶' },
	{ kana: 'しんぶん', kanji: '新聞', zh: '報紙' },
	{ kana: 'ざっし', kanji: '雑誌', zh: '雜誌' },
	{ kana: 'でんわ', kanji: '電話', zh: '電話' },
	{ kana: 'テレビ', zh: '電視' },
	{ kana: 'パソコン', zh: '個人電腦' },
	{ kana: 'きっぷ', kanji: '切符', zh: '車票' },
	{ kana: 'おかね', kanji: 'お金', zh: '錢' },

	// ── 交通 ──────────────────────────────────────────────────────────────────
	{ kana: 'くるま', kanji: '車', zh: '車子' },
	{ kana: 'じてんしゃ', kanji: '自転車', zh: '腳踏車' },
	{ kana: 'でんしゃ', kanji: '電車', zh: '電車' },
	{ kana: 'バス', zh: '公車' },
	{ kana: 'ひこうき', kanji: '飛行機', zh: '飛機' },

	// ── 食べ物・飲み物 ────────────────────────────────────────────────────────
	{ kana: 'みず', kanji: '水', zh: '水' },
	{ kana: 'おちゃ', kanji: 'お茶', zh: '茶' },
	{ kana: 'コーヒー', zh: '咖啡' },
	{ kana: 'ぎゅうにゅう', kanji: '牛乳', zh: '牛奶' },
	{ kana: 'ビール', zh: '啤酒' },
	{ kana: 'ごはん', kanji: 'ご飯', zh: '飯' },
	{ kana: 'パン', zh: '麵包' },
	{ kana: 'にく', kanji: '肉', zh: '肉' },
	{ kana: 'さかな', kanji: '魚', zh: '魚' },
	{ kana: 'やさい', kanji: '野菜', zh: '蔬菜' },
	{ kana: 'くだもの', kanji: '果物', zh: '水果' },

	// ── 時間 ──────────────────────────────────────────────────────────────────
	{ kana: 'あさ', kanji: '朝', zh: '早上' },
	{ kana: 'よる', kanji: '夜', zh: '晚上' },
	{ kana: 'きょう', kanji: '今日', zh: '今天' },
	{ kana: 'あした', kanji: '明日', zh: '明天' },
	{ kana: 'きのう', kanji: '昨日', zh: '昨天' },
	{ kana: 'まいにち', kanji: '毎日', zh: '每天' },
	{ kana: 'しゅうまつ', kanji: '週末', zh: '週末' },
	{ kana: 'じかん', kanji: '時間', zh: '時間' },

	// ── 天気・自然 ────────────────────────────────────────────────────────────
	{ kana: 'てんき', kanji: '天気', zh: '天氣' },
	{ kana: 'あめ', kanji: '雨', zh: '雨' },
	{ kana: 'ゆき', kanji: '雪', zh: '雪' },
	{ kana: 'かぜ', kanji: '風', zh: '風' },
	{ kana: 'うみ', kanji: '海', zh: '海' },
	{ kana: 'やま', kanji: '山', zh: '山' },
	{ kana: 'いぬ', kanji: '犬', zh: '狗' },
	{ kana: 'ねこ', kanji: '猫', zh: '貓' },

	// ── 形容詞 ────────────────────────────────────────────────────────────────
	{ kana: 'たかい', kanji: '高い', zh: '高的、貴的' },
	{ kana: 'やすい', kanji: '安い', zh: '便宜的' },
	{ kana: 'おおきい', kanji: '大きい', zh: '大的' },
	{ kana: 'ちいさい', kanji: '小さい', zh: '小的' },
	{ kana: 'あたらしい', kanji: '新しい', zh: '新的' },
	{ kana: 'おいしい', kanji: '美味しい', zh: '好吃的' },
	{ kana: 'たのしい', kanji: '楽しい', zh: '開心的' },
	{ kana: 'いそがしい', kanji: '忙しい', zh: '忙碌的' },
	{ kana: 'しずか', kanji: '静か', zh: '安靜' },
	{ kana: 'げんき', kanji: '元気', zh: '有精神、健康' },

	// ── 動詞 ──────────────────────────────────────────────────────────────────
	{ kana: 'たべる', kanji: '食べる', zh: '吃' },
	{ kana: 'のむ', kanji: '飲む', zh: '喝' },
	{ kana: 'いく', kanji: '行く', zh: '去' },
	{ kana: 'みる', kanji: '見る', zh: '看' },
	{ kana: 'かく', kanji: '書く', zh: '寫' },
	{ kana: 'よむ', kanji: '読む', zh: '讀' },
	{ kana: 'はなす', kanji: '話す', zh: '說' },
	{ kana: 'べんきょう', kanji: '勉強', zh: '學習' },
	{ kana: 'しごと', kanji: '仕事', zh: '工作' },

	// ── あいさつ ──────────────────────────────────────────────────────────────
	{ kana: 'ありがとう', zh: '謝謝' },
	{ kana: 'おはよう', zh: '早安' },
	{ kana: 'こんにちは', zh: '你好' },
	{ kana: 'さようなら', zh: '再見' },
	{ kana: 'すみません', zh: '不好意思、對不起' },
	{ kana: 'はじめまして', zh: '初次見面' }
];
