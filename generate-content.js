/*
 * AI 콘텐츠 완전 자동 생성 — Gemini API (Google AI Studio)
 *
 * 필요 준비물 (Netlify 환경변수에 등록):
 *   GEMINI_API_KEY — https://aistudio.google.com/apikey 에서 발급 (무료 사용량으로 시작 가능)
 *
 * 요청 본문 (JSON):
 *   { "prompt": "..." }
 *
 * 왜 서버리스 함수로 감싸는가: Gemini는 브라우저에서 직접 호출도 가능하지만, 그러면 API 키가
 * 브라우저 코드/네트워크 탭에 그대로 노출됩니다. 다른 채널 함수들과 동일하게 키를 서버(Netlify
 * 환경변수)에만 두고, 프론트엔드는 이 함수만 호출하도록 통일했습니다.
 *
 * 계정 정보가 없으면 다른 채널 함수와 동일하게 501(not_configured)을 반환합니다 — 화면 동작에는
 * 영향 없이, 사용자는 기존처럼 "프롬프트 복사 → 무료 채팅에 붙여넣기"로 계속 쓸 수 있습니다.
 */
var shared = require('./_shared/response');

// 'gemini-flash-latest'는 Google이 관리하는 별칭(alias)으로, 항상 현재 권장되는 최신 flash
// 모델을 가리킵니다. 특정 모델명을 직접 고정하면(예: gemini-2.0-flash) 나중에 그 모델이
// 지원 종료(404)될 수 있어, 별칭을 사용해 유지보수 부담을 줄였습니다.
var GEMINI_MODEL = 'gemini-flash-latest';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return shared.json(405, { ok: false, error: 'method_not_allowed' });
  }

  var missing = shared.requireEnv(['GEMINI_API_KEY']);
  if (missing.length) return shared.notConfigured(missing);

  var body = shared.parseBody(event);
  if (!body || !body.prompt) {
    return shared.json(400, { ok: false, error: 'missing_fields', required: ['prompt'] });
  }

  var GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL +
    ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);

  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: '항상 자연스러운 한국어로만 답변하세요. 영어나 다른 언어를 섞지 마세요.' }] },
        contents: [{ parts: [{ text: body.prompt }] }]
      })
    });
    var data = await res.json();

    if (!res.ok) {
      return shared.json(502, { ok: false, error: 'gemini_api_error', detail: data });
    }

    var parts = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts;
    var text = parts ? parts.map(function (p) { return p.text || ''; }).join('') : '';

    if (!text) {
      return shared.json(502, { ok: false, error: 'empty_response', detail: data });
    }

    return shared.json(200, { ok: true, text: text });
  } catch (err) {
    return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
  }
};
