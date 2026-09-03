/*
 * 유튜브(메디마크TV) 자동 업로드 — YouTube Data API v3
 *
 * 필요 준비물 (킥오프미팅에서 확인 후 Netlify 환경변수에 등록):
 *   YOUTUBE_CLIENT_ID       — Google Cloud 프로젝트의 OAuth 클라이언트 ID
 *   YOUTUBE_CLIENT_SECRET    — 위 클라이언트의 시크릿
 *   YOUTUBE_REFRESH_TOKEN     — 메디마크TV 채널 소유자 계정으로 최초 1회 OAuth 동의 후 발급받는 갱신 토큰
 *
 * 요청 본문 (JSON):
 *   {
 *     "videoUrl": "https://.../video.mp4",   // 공개적으로 접근 가능한 영상 파일 URL (필수)
 *     "title": "영상 제목",                    // 필수
 *     "description": "영상 설명",               // 선택
 *     "tags": ["태그1", "태그2"],               // 선택
 *     "privacyStatus": "private"                // 선택, 기본값 private
 *   }
 *
 * 흐름: ①OAuth 액세스 토큰 갱신 → ②영상 파일을 videoUrl에서 내려받기 →
 *      ③resumable 업로드 세션 시작 → ④영상 바이너리 업로드
 *
 * ⚠️ 중요 제약 1 — README 로드맵 3단계 참고:
 * Google 앱 검토(컴플라이언스 감사)를 통과하기 전까지는 이 API로 업로드한 영상이
 * 자동으로 "비공개"로 처리됩니다. 심사 통과 전에는 이 함수가 성공해도 시청자에게는
 * 보이지 않습니다 — 이건 버그가 아니라 YouTube 정책입니다.
 *
 * ⚠️ 중요 제약 2 — 파일 크기/시간 제한:
 * Netlify Functions(기본 동기 함수)는 요청 처리 시간과 메모리에 제한이 있어 큰 영상
 * 파일(대략 몇백MB 이상, 또는 처리 시간이 긴 경우)은 타임아웃되거나 실패할 수 있습니다.
 * 짧은 클립 위주로 먼저 테스트하고, 정식 운영 규모가 커지면 Netlify Background Functions
 * (최대 15분 실행) 전환을 검토하세요.
 */
var shared = require('./_shared/response');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return shared.json(405, { ok: false, error: 'method_not_allowed' });
  }

  var missing = shared.requireEnv(['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN']);
  if (missing.length) return shared.notConfigured(missing);

  var body = shared.parseBody(event);
  if (!body || !body.videoUrl || !body.title) {
    return shared.json(400, { ok: false, error: 'missing_fields', required: ['videoUrl', 'title'] });
  }

  try {
    // ① OAuth 액세스 토큰 갱신
    var tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      }).toString()
    });
    var tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return shared.json(502, { ok: false, error: 'token_refresh_failed', detail: tokenData });
    }
    var accessToken = tokenData.access_token;

    // ② 영상 파일을 공개 URL에서 내려받기
    var videoRes = await fetch(body.videoUrl);
    if (!videoRes.ok) {
      return shared.json(400, { ok: false, error: 'video_fetch_failed', status: videoRes.status });
    }
    var videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    var contentType = videoRes.headers.get('content-type') || 'video/mp4';

    // ③ resumable 업로드 세션 시작 (메타데이터 먼저 전송)
    var initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuffer.length)
        },
        body: JSON.stringify({
          snippet: {
            title: body.title,
            description: body.description || '',
            tags: body.tags || []
          },
          status: {
            // Google 앱 심사 통과 전에는 어차피 자동으로 비공개 처리됩니다.
            privacyStatus: body.privacyStatus || 'private'
          }
        })
      }
    );

    if (!initRes.ok) {
      var initErr = await initRes.json().catch(function () { return null; });
      return shared.json(502, { ok: false, error: 'upload_session_init_failed', detail: initErr });
    }

    var uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return shared.json(502, { ok: false, error: 'no_upload_url_returned' });
    }

    // ④ 영상 바이너리 업로드
    var putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(videoBuffer.length)
      },
      body: videoBuffer
    });
    var putData = await putRes.json().catch(function () { return null; });

    if (!putRes.ok) {
      return shared.json(502, { ok: false, error: 'upload_failed', detail: putData });
    }

    var isPrivate = (body.privacyStatus || 'private') === 'private';
    return shared.json(200, {
      ok: true,
      videoId: putData && putData.id,
      status: putData && putData.status,
      note: isPrivate
        ? 'Google 앱 심사 통과 전이라 영상이 비공개로 업로드되었습니다 (정상 동작).'
        : '영상이 업로드되었습니다.'
    });
  } catch (err) {
    return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
  }
};
