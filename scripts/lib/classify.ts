// 阅读/听力“信息提取方式”、听力场景、即时应答话语功能、汉字读音干扰类型的规则分类器。
// 输入可能是私有文本（题干、台词），输出只有标签 id。
import type { MondaiType } from '../../src/lib/domain.ts';

export interface Taxon {
  id: string;
  label: string;
  desc: string;
}

// ───────────── 阅读 ─────────────
export const READING_SKILLS: Taxon[] = [
  { id: 'r:info_search', label: '条件匹配・信息检索', desc: '在广告、通知等材料中按条件筛选、计算金额或确认手续。解题时先读问题，圈出条件（身份、日期、金额），再回到材料逐项排除。' },
  { id: 'r:compare_ab', label: 'A/B 比较（共同点・不同点）', desc: '比较两篇文章的观点。先概括 A、B 各自的立场，再判断选项是“共同点”还是“分歧点”。' },
  { id: 'r:message_purpose', label: '文书・邮件主旨', desc: '判断邮件、通知想传达什么或要求读者做什么。重点看结尾的请求句与「〜てください」「〜お願いします」。' },
  { id: 'r:summary', label: '概括・空栏补全', desc: '把文章要点归纳到给定框架或填入空栏。需要把握段落之间的逻辑关系。' },
  { id: 'r:reference', label: '指示内容', desc: '判断「それ」「そこ」「この〜」等指示词所指。答案通常在指示词前面的一两句。' },
  { id: 'r:underline', label: '画线部含义（どういうことか）', desc: '用自己的话解释画线部。答案往往是画线部前后文的同义改写，警惕原文照抄的干扰项。' },
  { id: 'r:reason', label: '理由・因果（なぜ）', desc: '找出原因或理由。注意「〜から」「〜ため」「というのも」「〜のは〜からだ」等因果标志。' },
  { id: 'r:purpose', label: '目的・意图（何のため）', desc: '判断作者举例、做某事的目的。注意「〜ために」「〜ように」以及举例后的总结句。' },
  { id: 'r:feeling', label: '心情・态度', desc: '把握人物或作者的心情、态度变化，常见于随笔、小说类文章。' },
  { id: 'r:author_claim', label: '作者主张・最想表达的观点', desc: '把握全文主旨。重点看结尾段、「〜のではないだろうか」「〜べきだ」「つまり」等主张标志。' },
  { id: 'r:content_match', label: '内容一致判断', desc: '判断与本文内容相符的选项。逐一回原文核对，排除“部分正确”“过度推断”的干扰项。' },
  { id: 'r:explanation', label: '作者对特定话题的看法', desc: '「〜について筆者はどのように考えて/とらえて/述べているか」：把握作者对某一话题的评价或定位，注意与全文主旨区分。' },
  { id: 'r:detail', label: '具体信息（条件・方法・场合等）', desc: '根据本文找出具体信息（筆者によると、どのような場合/方法/点）。定位关键词所在段落后细读。' },
  { id: 'r:other', label: '其他', desc: '未归入上述类型的问题。' },
];

export function classifyReadingStem(type: MondaiType, stem: string): string {
  const s = stem.replace(/\s+/g, '');
  if (type === 'info_retrieval') return 'r:info_search';
  if (type === 'reading_integrated' || /[AＡ]と[BＢ]|[AＡ].{0,6}[BＢ]/.test(s)) return 'r:compare_ab';
  if (/(この|次の)(メール|文書|お知らせ|案内|手紙|通知|文章の件名)|件名|この文章は(何|なに)を(知らせ|伝え)/.test(s)) return 'r:message_purpose';
  if (/まとめる|（\s*）に入る|\(\s*\)に入る|空欄|続く言葉|入る言葉/.test(s)) return 'r:summary';
  if (/(何|なに)を指|指している|[こそあ](れ|こ|の)[^、]{0,6}とは(何|なに)を/.test(s)) return 'r:reference';
  if (/なぜ|どうして|理由|原因/.test(s)) return 'r:reason';
  if (/とあるが|とあるのは|とは[、，]?(どういう|どのような|どんな|何|なに|いつ)|それはどのような(意味|こと)|どのような意味か|とはどういうことか/.test(s)) return 'r:underline';
  if (/何のため|目的|意図|例を(使|挙|あげ)|例として/.test(s)) return 'r:purpose';
  if (/気持ち|心情|態度|どう感じ|思いを|感じているか/.test(s)) return 'r:feeling';
  if (/筆者.{0,6}(最も|もっとも)?言いたい|筆者の(考え|主張)|筆者の意見|この文章で筆者が述べていること/.test(s)) return 'r:author_claim';
  if (/合っている|合うもの|合うのは|正しいもの|一致|当てはまる/.test(s)) return 'r:content_match';
  if (/(考えて|とらえて|捉えて|述べて|説明して|見て|言って|思って)いるか|考えか/.test(s)) return 'r:explanation';
  if (/によると|何か|どのような|どんな|どう|どれか|いつ|どこ|何が|何を|何だ/.test(s)) return 'r:detail';
  return 'r:other';
}

// ───────────── 听力 ─────────────
export const LISTENING_SKILLS: Taxon[] = [
  { id: 'l:task_first', label: '课题理解・最先要做的事', desc: '「まず何をしますか」：对话中会出现多个待办事项，需排出先后顺序，注意「その前に」「先に」「とりあえず」。' },
  { id: 'l:task_next', label: '课题理解・接下来做什么', desc: '「このあと何をしますか」：注意对话中被否定、已完成或交给别人的事项，答案通常在最后的决定里。' },
  { id: 'l:task_obligation', label: '课题理解・必须做的事', desc: '「何をしなければなりませんか」：区分“必须”与“可选/不需要”，注意「〜なくてもいい」「〜ておいて」。' },
  { id: 'l:task_object', label: '课题理解・准备/购买/提交的对象', desc: '「何を買いますか/持っていきますか」：边听边在选项上排除，注意数量与替代方案。' },
  { id: 'l:task_method', label: '课题理解・方法/做法', desc: '「どうしますか/どうやって〜」：把握最终采用的方法，注意建议被否定后的修正。' },
  { id: 'l:task_choice', label: '课题理解・选择（日期/地点/方案）', desc: '「どの/いつ/どこ」：条件比较型，边听边记下各选项的可行性。' },
  { id: 'l:task_action', label: '课题理解・要做的事（其他）', desc: '其他课题理解问题。' },
  { id: 'l:point_reason', label: '要点理解・理由/原因/契机', desc: '「どうして/理由は何だと言っていますか」：注意「実は」「というのも」「〜からなんです」后的真正理由，排除对方猜测的理由。' },
  { id: 'l:point_most', label: '要点理解・最重要的一点', desc: '「一番〜のは何ですか」：说话人会列举多点，注意「何より」「一番」「特に」后的内容。' },
  { id: 'l:point_problem', label: '要点理解・问题点/需改进之处', desc: '「何が問題だと言っていますか/改良すべき点」：注意转折「ただ」「でも」「〜が気になる」。' },
  { id: 'l:point_feature', label: '要点理解・特点/优点', desc: '「どんな点がいいと言っていますか/特徴」：把握说话人强调的卖点或优点。' },
  { id: 'l:point_opinion', label: '要点理解・意见/评价', desc: '「どう思っていますか」：区分说话人的意见与转述他人的意见。' },
  { id: 'l:point_decision', label: '要点理解・决定/变更的事项', desc: '「どの予定を変更しますか/何を変えますか」：注意讨论后的最终决定。' },
  { id: 'l:point_purpose', label: '要点理解・目的', desc: '「何のために〜」：把握行为的目的。' },
  { id: 'l:point_content', label: '要点理解・具体内容', desc: '其他要点理解问题（何/どんな）。' },
  { id: 'l:sum_theme', label: '概要理解・主题（在谈什么）', desc: '「何について話していますか」：问题在最后才出现，需边听边归纳整体话题，警惕只覆盖局部的选项。' },
  { id: 'l:sum_claim', label: '概要理解・主张/意图', desc: '「言いたいことは何ですか/どう考えていますか」：把握说话人的核心观点，常在结尾。' },
  { id: 'l:sum_attitude', label: '概要理解・态度/评价', desc: '把握说话人对某事的评价与态度。' },
  { id: 'l:sum_gist', label: '概要理解・其他', desc: '其他概要理解问题。' },
  { id: 'l:quick_response', label: '即时应答・选择合适的回应', desc: '听一句话后选择合适的回应。关键在于理解话语功能（请求、抱怨、称赞、讽刺等）与惯用表达。' },
  { id: 'l:int_choice', label: '综合理解・比较后选择', desc: '「どれにしますか/どれを選びますか」：边听边记下各选项特点，并结合说话人的条件进行筛选。' },
  { id: 'l:int_opinion', label: '综合理解・各自的观点', desc: '比较两人对同一信息的看法。' },
  { id: 'l:int_compare', label: '综合理解・其他', desc: '其他综合理解问题。' },
];

export const LISTENING_SCENES: Taxon[] = [
  { id: 's:office', label: '公司・职场', desc: '' },
  { id: 's:school', label: '大学・学校', desc: '' },
  { id: 's:shop', label: '店铺・商业设施', desc: '' },
  { id: 's:phone', label: '电话', desc: '' },
  { id: 's:media', label: '电视・广播', desc: '' },
  { id: 's:lecture', label: '讲座・演讲・说明会', desc: '' },
  { id: 's:public', label: '公共设施（政府/医院/美术馆/车站等）', desc: '' },
  { id: 's:home', label: '家庭', desc: '' },
  { id: 's:other', label: '其他/未注明', desc: '' },
];

export const UTTERANCE_FUNCTIONS: Taxon[] = [
  { id: 'f:apology', label: '道歉', desc: '' },
  { id: 'f:thanks', label: '感谢', desc: '' },
  { id: 'f:request', label: '请求・委托', desc: '' },
  { id: 'f:permission', label: '请求许可', desc: '' },
  { id: 'f:invite', label: '劝诱・提议', desc: '' },
  { id: 'f:praise', label: '称赞・感叹', desc: '' },
  { id: 'f:complaint', label: '不满・责备・后悔', desc: '' },
  { id: 'f:worry', label: '担心・困扰', desc: '' },
  { id: 'f:hearsay', label: '传闻・转述', desc: '' },
  { id: 'f:report', label: '报告・联络', desc: '' },
  { id: 'f:question', label: '询问・确认', desc: '' },
  { id: 'f:statement', label: '陈述・感想', desc: '' },
];

export function classifyListening(type: MondaiType, question: string): string {
  const q = question.replace(/\s+/g, '');
  switch (type) {
    case 'listen_task':
      if (/まず|最初|はじめに|初めに|先に/.test(q)) return 'l:task_first';
      if (/なければ|必要があ|ないといけ/.test(q)) return 'l:task_obligation';
      if (/どう(やって|すれば|し|修正|直|変更)|どのように|どのような方法/.test(q)) return 'l:task_method';
      if (/(何|なに)を(買|持|準備|用意|送|書|提出|再提出|注文|選|渡|調べ|確認)/.test(q)) return 'l:task_object';
      if (/どの|どれ|どこ|いつ|何時|何日|何曜日|どちら|何番/.test(q)) return 'l:task_choice';
      if (/この(あと|後)|これから|次に|今から/.test(q)) return 'l:task_next';
      return 'l:task_action';
    case 'listen_point':
      if (/なぜ|どうして|理由|原因|きっかけ/.test(q)) return 'l:point_reason';
      if (/一番|最も|もっとも|いちばん|特に|1番/.test(q)) return 'l:point_most';
      if (/問題|課題|改善|改良|困って|悩み|足りな|反省|心配|注意/.test(q)) return 'l:point_problem';
      if (/特徴|どんな点|どのような点|良さ|魅力|利点|メリット|長所|よかった|いい/.test(q)) return 'l:point_feature';
      if (/どう(思|考)|意見|評価|感想/.test(q)) return 'l:point_opinion';
      if (/変更|変え|決め|ことにし|採用|選ん|にしますか/.test(q)) return 'l:point_decision';
      if (/目的|何のため/.test(q)) return 'l:point_purpose';
      return 'l:point_content';
    case 'listen_summary':
      if (/何について|テーマ|話題|何の話/.test(q)) return 'l:sum_theme';
      if (/言いたい|主張|伝えたい|意見|考えて|考え/.test(q)) return 'l:sum_claim';
      if (/どう思|評価|気持ち|態度|感じ/.test(q)) return 'l:sum_attitude';
      return 'l:sum_gist';
    case 'listen_quick':
      return 'l:quick_response';
    case 'listen_integrated':
      if (/どれ|どの|何番|どこ|どちら|どんな.{0,8}(買|選|する|行)|にしますか/.test(q)) return 'l:int_choice';
      if (/どう(思|考)|意見/.test(q)) return 'l:int_opinion';
      return 'l:int_compare';
    default:
      return 'l:task_action';
  }
}

export function classifyScene(scene: string): string {
  const s = scene.replace(/\s+/g, '');
  if (!s) return 's:other';
  if (/電話|留守/.test(s)) return 's:phone';
  if (/テレビ|ラジオ|番組|ニュース|放送/.test(s)) return 's:media';
  if (/講演|講座|セミナー|説明会|発表|シンポジウム|研修|授業で先生|講義/.test(s)) return 's:lecture';
  if (/大学|学校|教室|授業|ゼミ|研究室|高校|学生|キャンパス|部活|サークル|留学|入学|卒業/.test(s)) return 's:school';
  if (/会社|職場|オフィス|事務所|営業|工場|社員|部長|課長|会議|上司|同僚|本社|支店|店長|社/.test(s)) return 's:office';
  if (/店|スーパー|デパート|電気屋|レストラン|カフェ|ホテル|旅館|コンビニ|売り場|ショップ|専門店|喫茶|旅行会社|不動産/.test(s)) return 's:shop';
  if (/役所|市役所|区役所|美術館|博物館|病院|歯医者|クリニック|駅|空港|図書館|体育館|公園|競技場|入り口|窓口|センター|施設|会場|動物園|郵便局|銀行/.test(s)) return 's:public';
  if (/家|自宅|夫婦|家族|親子|兄弟|姉妹/.test(s)) return 's:home';
  return 's:other';
}

export function classifyUtterance(utterance: string): string {
  const u = utterance.replace(/\s+/g, '');
  if (/すみません|申し訳|ごめん|失礼しました/.test(u)) return 'f:apology';
  if (/ありがとう|おかげ|助かりました|助かった/.test(u)) return 'f:thanks';
  if (/させて(もらえ|いただけ|ください|くれ)|てもいい(です)?か|てもよろしい|てもかまいませんか/.test(u)) return 'f:permission';
  if (/[てで](もらえ|いただけ|くれ(ない|ません|る)|ください|ほしい)|お願い|願え|ていただけると|てもらえると|てくれると|助かるんですが/.test(u)) return 'f:request';
  if (/ませんか|ましょう|しようよ|ない[?？]$|たらどう|ほうがいい|方がいい|てみたら|どうですか/.test(u)) return 'f:invite';
  if (/さすが|すごい|頭が下が|見事|ならでは|上手|うまい|よく(やった|できた|頑張)|まとまって|立派|感心/.test(u)) return 'f:praise';
  if (/のに[。！!…]*$|始末|ばっかりに|ばかりに|せいで|くせに|いい加減|勝手|まったく|さんざん|なんて|ばよかった|じゃなかった|ものを|一方なんです|一方で/.test(u)) return 'f:complaint';
  if (/困っ|どうしよう|心配|大丈夫|不安|慣れない|一向に|間に合|ギクシャク|やばい/.test(u)) return 'f:worry';
  if (/んだって|って[。！!?？]*$|らしい|そうだ|そうです|とか[。]?$|って書いてあった|って聞いた/.test(u)) return 'f:hearsay';
  if (/の件|報告|ですが[。…]*$|なんですが|お伝え|連絡/.test(u)) return 'f:report';
  if (/か[。？?]*$|の[？?]$|[？?]$|っけ/.test(u)) return 'f:question';
  return 'f:statement';
}

// ───────────── 汉字读音干扰类型 ─────────────
export const READING_FEATURES: Taxon[] = [
  { id: 'kr:dakuten', label: '清音/浊音（半浊音）', desc: '干扰项只在清浊上不同，如「かいかく／がいかく」。注意连浊（如「手紙→てがみ」）与不连浊的词。' },
  { id: 'kr:long', label: '长音/短音', desc: '干扰项只在长短音上不同，如「しょうち／しょち」「ゆうずう／ゆずう」。' },
  { id: 'kr:sokuon', label: '促音（っ）有无', desc: '干扰项只在促音上不同，如「がっき／がき」「けっか／けか」。' },
  { id: 'kr:yoon', label: '拗音/直音', desc: '干扰项在拗音（ゃゅょ）与直音之间不同，如「じゅうよう／じゅよう」「きょうぎ／きゅうぎ」。' },
  { id: 'kr:hatsuon', label: '拨音（ん）有无', desc: '干扰项只在拨音上不同。' },
  { id: 'kr:other_reading', label: '其他读音/音训混淆', desc: '干扰项使用该汉字的其他音读、训读，或形近字的读音。需要准确记忆词语的固定读法。' },
  { id: 'kr:kun', label: '训读词（含送假名/单字）', desc: '考查词为训读（含送假名的动词/形容词或单个汉字）。' },
  { id: 'kr:on', label: '音读熟语', desc: '考查词为两个及以上汉字组成的音读词。' },
];

const DAKUTEN_MAP: Record<string, string> = {};
{
  const voiced = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
  const plain = 'かきくけこさしすせそたちつてとはひふへほはひふへほ';
  for (let i = 0; i < voiced.length; i++) DAKUTEN_MAP[voiced[i]] = plain[i];
}
const YOON_BASE: Record<string, string[]> = {
  き: ['か', 'く', 'こ'], し: ['さ', 'す', 'そ'], ち: ['た', 'つ', 'と'], に: ['な', 'ぬ', 'の'], ひ: ['は', 'ふ', 'ほ'],
  み: ['ま', 'む', 'も'], り: ['ら', 'る', 'ろ'], ぎ: ['が', 'ぐ', 'ご'], じ: ['ざ', 'ず', 'ぞ'], び: ['ば', 'ぶ', 'ぼ'], ぴ: ['ぱ', 'ぷ', 'ぽ'],
};
const VOWEL_OF: Record<string, string> = {};
{
  const rows: [string, string][] = [
    ['あかさたなはまやらわがざだばぱぁゃ', 'a'], ['いきしちにひみりぎじぢびぴぃ', 'i'], ['うくすつぬふむゆるぐずづぶぷぅゅ', 'u'],
    ['えけせてねへめれげぜでべぺぇ', 'e'], ['おこそとのほもよろをごぞどぼぽぉょ', 'o'],
  ];
  for (const [chars, v] of rows) for (const c of chars) VOWEL_OF[c] = v;
}

function toHiragana(s: string): string {
  return s.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

type Norm = (s: string) => string;
const normDakuten: Norm = (s) => s.replace(/./g, (c) => DAKUTEN_MAP[c] ?? c);
const normSokuon: Norm = (s) => s.replace(/っ/g, '');
const normHatsuon: Norm = (s) => s.replace(/ん/g, '');
// 拗音：先把 ゅ/ょ 视为同类（「きょう/きゅう」类混淆），再把拗音转为直音（「きょ/こ」类混淆）
const normYoon: Norm = (s) =>
  s.replace(/ゅ/g, 'ょ').replace(/([きしちにひみりぎじびぴ])([ゃょ])/g, (_, a: string, b: string) => YOON_BASE[a][b === 'ゃ' ? 0 : 2]);
const normLong: Norm = (s) => {
  let out = '';
  for (const c of s.replace(/ー/g, '')) {
    const prev = out[out.length - 1];
    const v = prev ? VOWEL_OF[prev] : undefined;
    if ((c === 'う' && (v === 'o' || v === 'u')) || (c === 'い' && v === 'e') || (c === 'あ' && v === 'a') || (c === 'お' && v === 'o') || (c === 'い' && v === 'i' && false)) continue;
    out += c;
  }
  return out;
};

const NORMS: [string, Norm][] = [
  ['kr:dakuten', normDakuten],
  ['kr:long', normLong],
  ['kr:sokuon', normSokuon],
  ['kr:yoon', normYoon],
  ['kr:hatsuon', normHatsuon],
];

function applyAll(s: string, except?: string): string {
  // 拗音规整需在长音规整之前（「しょう」→「そう」→「そ」）
  const order = ['kr:dakuten', 'kr:sokuon', 'kr:hatsuon', 'kr:yoon', 'kr:long'];
  let r = s;
  for (const id of order) if (id !== except) r = NORMS.find((n) => n[0] === id)![1](r);
  return r;
}

/** 分析正确读音与干扰项，返回本题考查的读音特征 id。 */
export function kanjiReadingFeatures(target: string | undefined, correct: string, distractors: string[]): string[] {
  const feats = new Set<string>();
  const c = toHiragana(correct);
  for (const raw of distractors) {
    const d = toHiragana(raw);
    if (!d || d === c) continue;
    if (applyAll(c) === applyAll(d)) {
      for (const [id] of NORMS) if (applyAll(c, id) !== applyAll(d, id)) feats.add(id);
    } else feats.add('kr:other_reading');
  }
  if (target) {
    if (/[ぁ-ん]/.test(target) || [...target].filter((ch) => /\p{Script=Han}/u.test(ch)).length === 1) feats.add('kr:kun');
    else feats.add('kr:on');
  }
  return [...feats];
}

// ───────────── 文章语法功能（未命中句型时的兜底） ─────────────
export const TEXT_FUNCTIONS: Taxon[] = [
  { id: 'tf:demonstrative', label: '文章语法・指示词', desc: '判断「この/その/こうした」等指示词与前文的照应。' },
  { id: 'tf:connective', label: '文章语法・接续词', desc: '根据前后句的逻辑关系（转折、因果、补充、换言）选择接续词。' },
  { id: 'tf:ending', label: '文章语法・文末表达', desc: '判断「〜のだ」「〜のではないか」「〜わけだ」等文末语气是否符合作者立场。' },
  { id: 'tf:voice', label: '文章语法・视点/语态', desc: '判断被动、使役、「〜てくる/〜ていく」等与叙述视点是否一致。' },
  { id: 'tf:content', label: '文章语法・内容衔接', desc: '选择与上下文内容衔接的词语或表达。' },
];

export function classifyTextFunction(answer: string): string {
  const a = answer.replace(/\s+/g, '');
  if (/^(この|その|あの|こう|そう|ああ|こんな|そんな|あんな|これ|それ|あれ|ここ|そこ|以下|上記|次の)/.test(a)) return 'tf:demonstrative';
  if (/^(しかし|ところが|それに|それで|そこで|つまり|すなわち|要するに|ただし|なお|もっとも|ちなみに|したがって|だから|なぜなら|というのも|それでも|一方|また|さらに|しかも|そのうえ|あるいは|または|ところで|さて|むしろ|かえって|とはいえ|では|すると|実は|結局|いわば)$/.test(a)) return 'tf:connective';
  if (/(のだ|のである|のです|だろう|でしょう|ではないか|かもしれない|わけだ|わけです|はずだ|らしい|ようだ|そうだ|のではない|ものだ|ことだ|に違いない|といえる|か。?)$/.test(a)) return 'tf:ending';
  if (/(られ|させ|せられ|てくる|てきた|ていく|ていった|てしまう|てしまった)/.test(a)) return 'tf:voice';
  return 'tf:content';
}
