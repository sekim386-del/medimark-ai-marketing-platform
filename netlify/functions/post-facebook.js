/*
 * 페이스북 페이지 자동 게시 — Meta Graph API
 *
 * 필요 준비물 (킥오프미팅에서 확인 후 Netlify 환경변수에 등록):
 *   FB_PAGE_ID           — 게시할 페이스북 페이지 ID
 *   FB_PAGE_ACCESS_TOKEN  — 페이지 액세스 토큰 (페이지 관리자 권한 + Meta 앱 심사 후 발급)
 *
 * 요청 본문 (JSON):
 *   { "message": "게시글 문구", "link": "https://... (선택)" }
 */
var shared = require('./_shared/response');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return shared.json(405, { ok: false, error: 'method_not_allowed' });
  }

  var missing = shared.requireEnv(['FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN']);
  if (missing.length) return shared.notConfigured(missing);

  var body = shared.parseBody(event);
  if (!body || !body.message) {
    return shared.json(400, { ok: false, error: 'missing_fields', required: ['message'] });
  }

  var FB_PAGE_ID = process.env.FB_PAGE_ID;
  var FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  var payload = { message: body.message, access_token: FB_PAGE_ACCESS_TOKEN };
  if (body.link) payload.link = body.link;

  try {
    var res = await fetch('https://graph.facebook.com/v19.0/' + FB_PAGE_ID + '/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!res.ok) {
      return shared.json(502, { ok: false, error: 'publish_failed', detail: data });
    }
    return shared.json(200, { ok: true, postId: data.id });
  } catch (err) {
    return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
  }
};
