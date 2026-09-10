import type { SentenceEntry } from './types.ts';

/**
 * Short everyday sentences (spec §7.1 item 9). 20 original lines, 8–20 kana each.
 * `kana` is the full reading and the typed target: no spaces, and the only punctuation
 * is 、。 (the engine maps them to `,` and `.`). `kanji` is the natural written form.
 */
export const SENTENCES: readonly SentenceEntry[] = [
	{ kana: 'きょうはいいてんきですね。', kanji: '今日はいい天気ですね。', zh: '今天天氣真好呢。' },
	{
		kana: 'あさはでんしゃでがっこうにいきます。',
		kanji: '朝は電車で学校に行きます。',
		zh: '早上搭電車去學校。'
	},
	{ kana: 'わたしはおちゃがすきです。', kanji: '私はお茶が好きです。', zh: '我喜歡茶。' },
	{ kana: 'ひるごはんをたべましたか。', kanji: '昼ご飯を食べましたか。', zh: '你吃過午餐了嗎？' },
	{
		kana: 'あしたはやすみですから、うみにいきます。',
		kanji: '明日は休みですから、海に行きます。',
		zh: '明天放假，所以要去海邊。'
	},
	{
		kana: 'このほんはとてもおもしろいです。',
		kanji: 'この本はとても面白いです。',
		zh: '這本書很有趣。'
	},
	{
		kana: 'えきまであるいてじゅっぷんです。',
		kanji: '駅まで歩いて十分です。',
		zh: '走到車站要十分鐘。'
	},
	{
		kana: 'ともだちといっしょにべんきょうします。',
		kanji: '友達と一緒に勉強します。',
		zh: '和朋友一起讀書。'
	},
	{
		kana: 'すみません、みずをください。',
		kanji: 'すみません、水をください。',
		zh: '不好意思，請給我水。'
	},
	{ kana: 'きのうはあめがふりました。', kanji: '昨日は雨が降りました。', zh: '昨天下雨了。' },
	{ kana: 'いぬとねこがだいすきです。', kanji: '犬と猫が大好きです。', zh: '我最喜歡狗和貓。' },
	{ kana: 'まどをあけてもいいですか。', kanji: '窓を開けてもいいですか。', zh: '可以開窗嗎？' },
	{
		kana: 'にちようびはうちでやすみます。',
		kanji: '日曜日はうちで休みます。',
		zh: '星期天在家休息。'
	},
	{
		kana: 'あのみせはやすくておいしいです。',
		kanji: 'あの店は安くて美味しいです。',
		zh: '那家店便宜又好吃。'
	},
	{
		kana: 'やまのうえからうみがみえます。',
		kanji: '山の上から海が見えます。',
		zh: '從山上可以看到海。'
	},
	{
		kana: 'おかあさんにてがみをかきました。',
		kanji: 'お母さんに手紙を書きました。',
		zh: '寫了一封信給媽媽。'
	},
	{
		kana: 'しゅうまつはうちでほんをよみます。',
		kanji: '週末はうちで本を読みます。',
		zh: '週末在家看書。'
	},
	{
		kana: 'このでんしゃはとうきょうにいきますか。',
		kanji: 'この電車は東京に行きますか。',
		zh: '這班電車開往東京嗎？'
	},
	{ kana: 'ゆっくりはなしてください。', kanji: 'ゆっくり話してください。', zh: '請慢慢說。' },
	{
		kana: 'きょうはしごとがいそがしいです。',
		kanji: '今日は仕事が忙しいです。',
		zh: '今天工作很忙。'
	}
];
