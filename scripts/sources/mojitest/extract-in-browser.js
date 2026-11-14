/*
 * MOJiTest 题库提取脚本（在浏览器中运行）。
 *
 * 前提：已用自己的账号（N1/N2 真题需要 PRO 权限）登录 https://test.mojidict.com 。
 * 用法：
 *   1. 打开 https://test.mojidict.com/library/N1 （或 N2），按 F12 打开开发者工具的 Console。
 *   2. 粘贴本文件全部内容并回车，等待提示 “完成”（每场约 10–15 秒，请求之间有间隔）。
 *   3. 在 Console 执行 copy(JSON.stringify(window.__jlxOut))，把剪贴板内容保存为
 *      .cache/mojitest/extract.json（N1、N2 两次的结果合并到同一个 JSON 对象里）。
 *   4. npm run ingest && npm run build:db
 *
 * 脚本只调用页面自身的数据加载函数（与手动逐题浏览等价），不读取或导出登录凭据。
 * 输出为精简的行格式：词汇/语法题只保留考查词与选项（短形式），阅读题保留题干的前 40 字，
 * 听力只保留场景与提问句（即时应答保留台词前 40 字），供本地规则分类；这些原文片段不会进入仓库。
 */
(async () => {
  const s = window.$nuxt.$store;
  let pb = null;
  (function walk(vm) {
    if (!vm) return;
    if ((vm.$options.name || vm.$options._componentTag) === 'paper-bank') pb = vm;
    (vm.$children || []).forEach(walk);
  })(window.$nuxt);
  if (!pb) throw new Error('请在 /library/N1 或 /library/N2 页面运行');

  let sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    // 用 Worker 计时，避免页面切到后台时定时器被节流
    const w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>setTimeout(()=>postMessage(0),e.data)'], { type: 'text/javascript' })));
    const q = [];
    w.onmessage = () => q.shift()?.();
    sleep = (ms) => new Promise((r) => { q.push(r); w.postMessage(ms); });
  } catch (e) { /* 退回 setTimeout */ }

  const dec = (t) => String(t || '').replace(/<rt>.*?<\/rt>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const sq = (t) => dec(t).replace(/[ \t　]+/g, '').replace(/\|/g, '｜').trim();
  const sents = (t) => dec(t).split(/\n|(?<=[。？?])/).map((x) => x.replace(/[ \t　]+/g, '').trim()).filter(Boolean);
  const spk = (x) => x.replace(/^[^：:「」。]{0,10}[：:]/, '');
  const qno = (id) => { const m = String(id).match(/(\d{3})(?:-\d{3})?\*/); return m ? +m[1] : ''; };
  const pno = (id) => { const m = String(id).match(/\*([^*]+)(?:\*([^*]+))?$/); return m ? (m[2] || m[1]) : ''; };
  const under = (t) => { const m = String(t || '').match(/<u>(.*?)<\/u>/i); return m ? sq(m[1]) : ''; };
  const afterWa = (q) => { const i = q.indexOf('は'); const r = i >= 0 && i < 14 ? q.slice(i + 1) : q; return r.replace(/[。？?]$/, '').slice(0, 30); };
  const isNarrQ = (x) => /(ますか|ですか|でしょうか|ましたか|でしたか)[。？?]?$/.test(x) && !/^\d/.test(x);

  async function run(examId) {
    const info = await s.dispatch('paper/fetchAllLargeQuestion', { examId });
    if (!info || !info.children) return `ERR layer ${examId}`;
    const out = [`#EXAM|${examId}|${info.tag}|${info.title}|v${info.vocabularyNum}|g${info.grammarNum}|r${info.readingNum}|l${info.listeningNum}`];
    const key = [];
    for (const L of info.children) {
      const t = L.questionType;
      const lang = t < 41;
      await sleep(500);
      const R = await s.dispatch('paper/fetchQuestionChildren', L.objectId);
      const r = R && R[0];
      if (!r) { out.push(`!ERR|${t}|${L.objectId}`); continue; }
      out.push(`@L|${t}|${sq(L.title).slice(0, 6)}|${L.questionsNum}`);
      for (const it of r.items || []) {
        const subs = it.items && it.items.length ? it.items : [it];
        const mid = it.items && it.items.length ? it : null;
        let ss = null;
        let nq = null;
        subs.forEach((q, si) => {
          const right = q.rightAnswer;
          if (lang) key.push(right);
          if (lang && t === 16) out.push(`${t}|${qno(q.identity)}|${right}|${sq(q.title).slice(0, 12)}|`);
          else if (lang && t <= 23) out.push(`${t}|${qno(q.identity)}|${right}|${under(q.title)}|${(q.options || []).map(sq).join('/')}`);
          else if (lang) out.push(`${t}|${qno(q.identity)}|${right}|${sq(q.title).slice(0, 40)}`);
          else {
            if (!ss) { ss = sents(mid ? mid.subtitle : q.subtitle).map(spk).filter(Boolean); nq = ss.filter(isNarrQ); }
            const scene = t === 45 ? null : (ss[0] || '').match(/^(.{1,9}?)で/);
            let qs = '';
            if (t === 45) qs = (ss[0] || '').slice(0, 40);
            else if (t === 43 || t === 46) qs = afterWa(nq.length >= subs.length ? nq[nq.length - subs.length + si] : nq[nq.length - 1] || '');
            else qs = afterWa(nq[0] || '');
            const img = q.imageId || (mid && mid.imageId) ? 1 : 0;
            out.push(`${t}|${pno(q.identity)}|${right}|${img}|${scene ? scene[1] : ''}|${qs}`);
          }
        });
      }
    }
    out.push(`#KEY|${key.join('')}`);
    return out.join('\n');
  }

  window.__jlxOut = window.__jlxOut || {};
  const list = pb.paperList.map((p) => p.objectId);
  for (let i = 0; i < list.length; i++) {
    if (window.__jlxOut[list[i]]) continue;
    window.__jlxOut[list[i]] = await run(list[i]);
    console.log(`[jlpt-atlas] ${i + 1}/${list.length} 完成`);
    await sleep(1000);
  }
  console.log('[jlpt-atlas] 完成。执行 copy(JSON.stringify(window.__jlxOut)) 复制结果。');
})();
