/*
 * medimark-marketing 데이터 정의
 * - 채널/서비스 마스터 데이터
 * - AI 프롬프트 템플릿 (무료 채팅용 — 유료 API 호출 없음)
 * - 채널별 "반자동 연동" 딥링크 헬퍼
 *
 * 이 파일은 회사 공식 자료(PDF 3종) + 홈페이지 확인 결과를 반영합니다.
 * 확정되지 않은 항목(TES MIND AI, 글로벌 의료관광, 블로그 플랫폼 등)은
 * 킥오프미팅 확인 후 이 파일만 고치면 앱 전체에 반영되도록 분리했습니다.
 */

// ── 서비스 마스터 (공식 사업 3가지 + 확장 후보 + 공통) ──
var SERVICES = [
  { id: 'medical-dispute', label: '의료분쟁', full: '의료분쟁 컨설팅', color: '#12AEDD' },
  { id: 'tci-counsel', label: 'TCI심리상담', full: 'TCI&심리상담', color: '#00C08B' },
  { id: 'book', label: '도서출판', full: '의료전문 도서 출판', color: '#F5A623' },
  { id: 'common', label: '공통', full: '공통/브랜드', color: '#8A8F93' }
];

// ── 채널 마스터 ──
var CHANNELS = [
  { id: 'youtube', label: '유튜브', note: '메디마크TV' },
  { id: 'instagram', label: '인스타그램', note: '' },
  { id: 'facebook', label: '페이스북', note: '' },
  { id: 'blog', label: '블로그', note: 'blog.naver.com/chung389 (네이버 추정, 확인 필요)' },
  { id: 'cardnews', label: '카드뉴스', note: 'Canva로 제작 (반자동)' }
];

// ── 콘텐츠 상태값 ──
var STATUSES = ['기획', '생성중', '검수중', '예정', '완료'];

// ── 실명 전문가 (공식 PDF 확인) — 프롬프트에 근거로 활용 ──
var EXPERTS = {
  'medical-dispute': '의료수사 전문 강윤석(경찰 최초 의료수사관 인증 1호), 대표 정기국',
  'tci-counsel': '정신과 이안백, 소아정신과 김소연',
  'book': '강윤석 저 「의료사고, 진실을 찾아서」, 이안백 저 「우리 아이 마음 지도, TCI로 읽다」',
  'common': '의학전문기자 장익경'
};

// ── 서비스별 준수사항 (킥오프미팅 회의록 2.5항 기반) ──
// TCI&심리상담: 온라인 직접 진단·신청 유도 금지(전화 상담으로 안내). 도서: 출처(도서명·저자) 명시.
var COMPLIANCE = {
  'tci-counsel': ' TCI 검사·심리상담은 온라인에서 직접 진단하거나 신청받는 것처럼 쓰지 말고, 상담은 전화 문의로 안내해줘.',
  'book': ' 도서 내용을 언급할 때는 책 제목과 저자를 함께 밝혀줘.'
};

// ── 채널×서비스별 AI 프롬프트 템플릿 생성기 ──
// 프리필된 프롬프트를 만들어 "복사 → ChatGPT/Claude 무료 채팅에 붙여넣기"로 바로 쓸 수 있게 합니다.
function buildPrompt(channelId, serviceId, topic) {
  var service = SERVICES.filter(function (s) { return s.id === serviceId; })[0] || SERVICES[3];
  var expertNote = EXPERTS[serviceId] || '';
  var base = '';

  var contextLine = '메디마크(의료분쟁 컨설팅·TCI&심리상담·의료전문 도서 출판 3개 사업을 운영하는 사회적기업)의 ' +
    service.full + ' 관련 콘텐츠입니다.' +
    (expertNote ? ' 참고 인물/자료: ' + expertNote + '.' : '') +
    ' 신뢰감 있는 톤으로, 과장·자극적 표현 없이 작성해줘.' +
    (COMPLIANCE[serviceId] || '') +
    '\n\n주제: ' + (topic || '[주제를 입력하세요]');

  if (channelId === 'youtube') {
    base = '다음 내용을 바탕으로 유튜브 영상 제목 후보 3개와 설명란 문구를 써줘.\n\n' + contextLine;
  } else if (channelId === 'instagram') {
    base = '다음 내용을 인스타그램 게시물 캡션으로 써줘. 친근한 톤, 해시태그 5개 포함, 3~4문장 이내로.\n\n' + contextLine;
  } else if (channelId === 'facebook') {
    base = '다음 내용을 페이스북 게시물 문구로 써줘. 신뢰감 있는 톤, 4~6문장으로.\n\n' + contextLine;
  } else if (channelId === 'blog') {
    base = '다음 주제로 블로그 포스팅 개요(목차, 소제목 4~5개)와 도입부 2문단을 써줘.\n\n' + contextLine;
  } else if (channelId === 'cardnews') {
    base = '다음 내용을 카드뉴스(이미지 슬라이드) 문구로 써줘. 총 5~6장 구성: ' +
      '①표지(제목, 한 줄 후킹 문구) ②~④본문(슬라이드당 한 가지 포인트, 15자 내외 짧은 문장) ' +
      '⑤마무리(요약 또는 상담 안내 CTA). 슬라이드 번호를 붙여서 구분해줘. 이 문구는 Canva에서 ' +
      '카드뉴스 디자인을 만들 때 그대로 붙여넣어 쓸 예정이야.\n\n' + contextLine;
  } else {
    base = contextLine;
  }
  return base;
}

// ── 채널별 "반자동 연동" 딥링크/오픈 URL ──
// 진짜 API 자동 게시는 계정 준비 + Meta/Google 심사 이후에나 가능하므로,
// 그 전까지는 "내용 복사 → 채널 열기 → 붙여넣기" 흐름으로 대체합니다.
function getChannelOpenUrl(channelId, channelLinkOverride) {
  if (channelLinkOverride) return channelLinkOverride;
  var map = {
    youtube: 'https://studio.youtube.com/',
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    blog: 'https://blog.naver.com/chung389',
    cardnews: 'https://www.canva.com/'
  };
  return map[channelId] || '#';
}

// ── 초기 시드 데이터 (킥오프미팅 전 예시) ──
// views/leads: 콘텐츠 마케팅의 최종 목표는 조회수가 아니라 "상담 신청(전환)"이므로,
// 두 값을 함께 기록해 서비스·채널별 전환율을 계산합니다.
function seedCalendar() {
  return [
    {
      id: 'c1', date: '2026-08-03', channel: 'youtube', service: 'medical-dispute',
      topic: '의료사고 전문가 인터뷰 - 강윤석 팀장 (「의료사고, 진실을 찾아서」 저자)',
      status: '완료', assignee: '박서연', draft: '', views: 1200, leads: 3
    },
    {
      id: 'c2', date: '2026-08-05', channel: 'blog', service: 'book',
      topic: '「우리 아이 마음 지도, TCI로 읽다」 도서 소개 (이안백 저)',
      status: '예정', assignee: '', draft: '', views: 0, leads: 0
    },
    {
      id: 'c3', date: '2026-08-07', channel: 'instagram', service: 'tci-counsel',
      topic: 'TCI 기질성격검사 소개 카드뉴스',
      status: '생성중', assignee: '박서연', draft: '', views: 340, leads: 5
    },
    {
      id: 'c4', date: '2026-08-10', channel: 'facebook', service: 'tci-counsel',
      topic: '학교 심리검사 시범사업 현장 소식 (파주 산내중학교 등)',
      status: '예정', assignee: '', draft: '', views: 0, leads: 0
    },
    {
      id: 'c5', date: '2026-08-12', channel: 'youtube', service: 'common',
      topic: '메디마크TV 신규 영상 안내',
      status: '예정', assignee: '', draft: '', views: 0, leads: 0
    }
  ];
}
