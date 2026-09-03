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

    // 인스타그램 서버가 이미지를 다운로드·처리할 시간이 필요합니다. status_code가
    // FINISHED가 되기 전에 바로 게시를 호출하면 "Media ID is not available" 오류가 납니다.
    // 주의: Netlify Functions(동기 함수)는 기본 실행시간 제한이 10초(플랜에 따라 최대 26초)라서,
    // Apps Script처럼 넉넉하게 기다릴 수 없습니다. 아래는 그 안에 맞춘 최소한의 대기(최대 4회 x 1.5초 = 6초)이며,
    // 실제 운영 중 타임아웃/미완료 오류가 잦으면 이 함수를 Netlify Background Function으로
    // 전환하는 걸 권장합니다(최대 15분까지 실행 가능, 파일명 끝에 '-background' 접미사 필요).
    var statusUrl = GRAPH_BASE + '/' + createData.id + '?fields=status_code&access_token=' + encodeURIComponent(IG_ACCESS_TOKEN);
    for (var i = 0; i < 4; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, 1500); });
      var statusRes = await fetch(statusUrl);
      var statusData = await statusRes.json();
      if (statusData.status_code === 'FINISHED') break;
      if (statusData.status_code === 'ERROR') {
        return shared.json(502, { ok: false, error: 'media_processing_failed', detail: statusData });
      }
      // IN_PROGRESS면 계속 대기 (마지막 시도까지 FINISHED가 안 되면, 그래도 일단 게시를 시도합니다 —
      // 대부분의 경우 이 시점이면 처리가 끝나 있고, 정말 안 끝났다면 아래 게시 호출이 명확한 오류를 반환합니다)
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
