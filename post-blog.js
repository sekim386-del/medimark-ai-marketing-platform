/*
 * 블로그 자동 게시 — 플랫폼별로 실행 가능 여부가 다릅니다 (requirements.html 01번 표 참고).
 *
 * 필요 준비물 (킥오프미팅에서 블로그 플랫폼 확정 후 Netlify 환경변수에 등록):
 *   BLOG_PLATFORM        — 'tistory' | 'wordpress' | 'naver'
 *   TISTORY_ACCESS_TOKEN   — 티스토리 Open API 토큰 (플랫폼이 티스토리인 경우)
 *   TISTORY_BLOG_NAME       — 티스토리 블로그 URL의 blogName 부분
 *   WP_SITE_URL              — 워드프레스 사이트 주소 (플랫폼이 워드프레스인 경우, REST API 사용)
 *   WP_USERNAME               — 워드프레스 애플리케이션 비밀번호용 계정
 *   WP_APP_PASSWORD            — 워드프레스에서 발급한 애플리케이션 비밀번호
 *
 * 요청 본문 (JSON):
 *   { "title": "제목", "content": "본문(HTML 가능)" }
 *
 * ⚠️ 네이버 블로그는 공식 포스팅 API가 없습니다 (검색 API만 제공). BLOG_PLATFORM이
 * 'naver'이면 이 함수는 의도적으로 실패를 반환합니다 — 비공식 자동화는 계정 정지
 * 위험이 있어 반자동(콘텐츠 준비 후 직접 게시) 방식을 그대로 유지해야 합니다.
 */
var shared = require('./_shared/response');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return shared.json(405, { ok: false, error: 'method_not_allowed' });
  }

  var missingPlatform = shared.requireEnv(['BLOG_PLATFORM']);
  if (missingPlatform.length) return shared.notConfigured(missingPlatform);

  var body = shared.parseBody(event);
  if (!body || !body.title || !body.content) {
    return shared.json(400, { ok: false, error: 'missing_fields', required: ['title', 'content'] });
  }

  var platform = process.env.BLOG_PLATFORM;

  if (platform === 'naver') {
    return shared.json(501, {
      ok: false,
      error: 'unsupported_platform',
      message: '네이버 블로그는 공식 포스팅 API가 없어 자동 게시를 지원하지 않습니다. ' +
        '콘텐츠를 준비한 뒤 앱의 "채널 연동" 기능으로 복사해서 직접 게시해주세요.'
    });
  }

  if (platform === 'tistory') {
    var missing = shared.requireEnv(['TISTORY_ACCESS_TOKEN', 'TISTORY_BLOG_NAME']);
    if (missing.length) return shared.notConfigured(missing);

    try {
      var params = new URLSearchParams({
        access_token: process.env.TISTORY_ACCESS_TOKEN,
        blogName: process.env.TISTORY_BLOG_NAME,
        title: body.title,
        content: body.content,
        visibility: '3', // 3 = 공개 발행. 초안으로 두려면 0(비공개)으로 바꾸세요.
        output: 'json'
      });
      var res = await fetch('https://www.tistory.com/apis/post/write?' + params.toString(), { method: 'GET' });
      var data = await res.json();
      if (!res.ok) return shared.json(502, { ok: false, error: 'publish_failed', detail: data });
      return shared.json(200, { ok: true, detail: data });
    } catch (err) {
      return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
    }
  }

  if (platform === 'wordpress') {
    var missingWp = shared.requireEnv(['WP_SITE_URL', 'WP_USERNAME', 'WP_APP_PASSWORD']);
    if (missingWp.length) return shared.notConfigured(missingWp);

    try {
      var auth = Buffer.from(process.env.WP_USERNAME + ':' + process.env.WP_APP_PASSWORD).toString('base64');
      var wpRes = await fetch(process.env.WP_SITE_URL.replace(/\/$/, '') + '/wp-json/wp/v2/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify({ title: body.title, content: body.content, status: 'publish' })
      });
      var wpData = await wpRes.json();
      if (!wpRes.ok) return shared.json(502, { ok: false, error: 'publish_failed', detail: wpData });
      return shared.json(200, { ok: true, postId: wpData.id, link: wpData.link });
    } catch (err) {
      return shared.json(500, { ok: false, error: 'unexpected_error', message: String(err) });
    }
  }

  return shared.json(400, { ok: false, error: 'unknown_platform', platform: platform });
};
