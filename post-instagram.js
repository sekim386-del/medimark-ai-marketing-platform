/*
 * 인스타그램 자동 게시 — Meta Graph API (Instagram Content Publishing API)
 *
 * 필요 준비물 (킥오프미팅에서 확인 후 Netlify 환경변수에 등록):
 *   IG_USER_ID          — 인스타그램 비즈니스/크리에이터 계정의 Instagram User ID
 *   IG_ACCESS_TOKEN      — 장기(long-lived) 액세스 토큰 (페이지 연결 + Meta 앱 심사 후 발급)
 *
 * 요청 본문 (JSON):
 *   { "imageUrl": "https://.../image.jpg", "caption": "게시글 문구" }
 *
 * 제약: Graph API는 로컬 파일 업로드가 아니라 "공개적으로 접근 가능한 이미지 URL"이
 * 필요합니다. 즉 이미지를 먼저 어딘가(예: Netlify에 함께 배포된 정적 파일, 또는
 * 무료 이미지 호스팅)에 올려서 URL을 만든 뒤 이 함수를 호출해야 합니다.
 *
 * 흐름: ①미디어 컨테이너 생성 → ②컨테이너 게시 (Graph API 표준 2단계 방식)
 */
var shared = require('./_shared/response');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return shared.json(405, { ok: false, error: 'method_not_allowed' });
  }

  var missing = shared.requireEnv(['IG_USER_ID', 'IG_ACCESS_TOKEN']);
  if (missing.length) return shared.notConfigured(missing);

  var body = shared.parseBody(event);
  if (!body || !body.imageUrl || !body.caption) {
    return shared.json(400, { ok: false, error: 'missing_fields', required: ['imageUrl', 'caption'] });
  }

  var IG_USER_ID = process.env.IG_USER_ID;
  var IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
  var GRAPH_BASE = 'https://graph.facebook.com/v19.0';

  try {
    // ① 미디어 컨테이너 생성
    var createRes = await fetch(GRAPH_BASE + '/' + IG_USER_ID + '/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: body.imageUrl,
        caption: body.caption,
        access_token: IG_ACCESS_TOKEN
      })
    });
    var createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
      return shared.json(502, { ok: false, error: 'container_create_failed', detail: createData });
    }

    // ② 컨테이너 게시
    var publishRes = await fetch(GRAPH_BASE + '/' + IG_USER_ID + '/media_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: createData.id,
        access_token: IG_ACCESS_TOKEN
      })
    });
    var publishData = await publishRes.json();
    if (!publishRes.ok) {
      return shared.json(502, { ok: false, error: 'publish_failed', detail: publishData });
    }

    return shared.json(200, { ok: true, mediaId: publishData.id });
  } catch (err) {
    return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
  }
};
