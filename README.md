# 실제 SNS 자동 게시 함수 + AI 콘텐츠 자동 생성 함수

`medimark-marketing/README.md`의 로드맵 4단계("실제 자동 게시 연동")를 위해 미리 준비해둔
코드 구조입니다. **채널 게시 함수는 계정 정보(API 키)가 없어서 호출해도 501(not_configured)
응답만 돌아옵니다** — 계정이 준비되면 환경변수만 채우면 바로 동작합니다.

`generate-content.js`(AI 콘텐츠 자동 생성, Gemini)는 다른 함수들과 별개로 **GEMINI_API_KEY만
등록하면 바로 사용 가능**합니다 (Meta/Google 앱 심사와 무관, 무료 사용량으로 시작 가능). 등록
전까지는 기존처럼 "프롬프트 복사 → 무료 채팅에 붙여넣기" 방식이 그대로 동작합니다.

## 왜 서버리스 함수가 필요한가
정적 HTML/JS만으로는 SNS API 키 같은 비밀값을 안전하게 보관할 수 없습니다(브라우저 코드는
누구나 볼 수 있음). Netlify Functions는 **무료 티어**로 제공되는 최소한의 서버리스 함수라
"완전 무료 구조" 원칙을 깨지 않으면서 API 키를 안전하게 다룰 수 있습니다.

## 파일 구성
```
netlify/
  functions/
    _shared/response.js   공통 응답 헬퍼 (JSON 응답, 필수 환경변수 체크)
    post-instagram.js       인스타그램 게시 (Meta Graph API)
    post-facebook.js         페이스북 페이지 게시 (Meta Graph API)
    post-youtube.js            유튜브 업로드 (YouTube Data API v3) — resumable 업로드까지 구현 완료
    post-blog.js                 블로그 게시 (티스토리/워드프레스 지원, 네이버는 의도적으로 미지원)
```

## 채널별 필요한 환경변수

| 채널/기능 | 환경변수 | 비고 |
|---|---|---|
| AI 콘텐츠 자동 생성 | `GEMINI_API_KEY` | aistudio.google.com에서 즉시 발급, 무료 사용량 내 사용 가능. 심사 불필요 |
| 인스타그램 | `IG_USER_ID`, `IG_ACCESS_TOKEN` | Meta 앱 심사(2~4주) 통과 후 발급 |
| 페이스북 | `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` | 인스타그램과 동일한 심사 절차 공유 |
| 유튜브 | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | Google 앱 검토 전에는 업로드 영상이 비공개 처리됨 |
| 블로그 | `BLOG_PLATFORM` + (플랫폼별 값) | 네이버는 공식 API가 없어 자동 게시 미지원, 티스토리/워드프레스만 가능 |

**절대로 실제 값을 이 저장소(git)에 커밋하지 마세요.** Netlify 대시보드 →
Site configuration → Environment variables 에만 등록합니다.

## 로컬에서 테스트하려면
```
npm install -g netlify-cli
netlify dev
```
이러면 `http://localhost:8888/.netlify/functions/post-instagram` 같은 주소로 함수를
호출해볼 수 있습니다 (환경변수는 `.env` 파일 또는 `netlify env:set`으로 등록, `.env`는
반드시 `.gitignore`에 포함).

## 다음에 할 일
1. 킥오프미팅에서 계정·플랫폼 확정
2. Meta/Google 앱 등록 및 심사 신청
3. 심사 통과 후 발급받은 토큰을 Netlify 환경변수에 등록
4. `medimark-marketing` 앱의 "채널 연동" 모달을 이 함수들을 호출하는 방식으로 교체
   (지금은 "복사 후 직접 게시"하는 반자동 방식)
