// YT.Places … 登録の「出身地」「現在の所在地」の選択肢。国は ISO 3166-1 の2文字のコードで持ち、名前はブラウザの日本語名（Intl.DisplayNames）で出す。
// 日本を選んだときだけ都道府県（JIS の 01〜47）を選ぶ。保存するのはコードだけ（firebase/firestore.rules が形を確かめる）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  // 人の住む国・地域（南極・無人の島々は外した）
  const CODES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
    'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ ' +
    'OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  // 九州を訪れる人の多い国・地域を上に（推定の並び）。そのあとは五十音順
  const FIRST = ['JP', 'KR', 'TW', 'CN', 'HK', 'US', 'TH', 'SG', 'AU', 'PH', 'VN', 'MY', 'ID', 'GB', 'FR', 'DE', 'CA'];
  const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
  let names = null;
  const dn = (() => { try { return new Intl.DisplayNames(['ja'], { type: 'region' }); } catch (e) { return null; } })();
  const SHORT = { JP: '日本', HK: '香港', MO: 'マカオ', US: 'アメリカ', GB: 'イギリス' }; // 長い正式名は、ふだんの呼び名に
  const name = (code) => SHORT[code] || (dn && dn.of(code)) || code;
  function countries() {
    if (names) return names;
    const coll = (() => { try { return new Intl.Collator('ja'); } catch (e) { return { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) }; } })();
    const rest = CODES.filter((c) => !FIRST.includes(c)).map((code) => ({ code, name: name(code) })).sort((a, b) => coll.compare(a.name, b.name));
    names = { first: FIRST.map((code) => ({ code, name: name(code) })), rest };
    return names;
  }
  const prefs = () => PREFS.map((n, i) => ({ code: String(i + 1).padStart(2, '0'), name: n }));
  const prefName = (code) => PREFS[Number(code) - 1] || '';
  const AGES = [['10s', '10代'], ['20s', '20代'], ['30s', '30代'], ['40s', '40代'], ['50s', '50代'], ['60s', '60代'], ['70plus', '70代以上']];
  const GENDERS = [['female', '女性'], ['male', '男性'], ['other', 'その他'], ['noanswer', '回答しない']];
  YT.Places = { countries, prefs, name, prefName, AGES, GENDERS, isCountry: (c) => CODES.includes(c) };
})();
