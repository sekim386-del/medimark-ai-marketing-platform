/*
 * medimark-marketing 앱 로직
 * 완전 무료 구조: 서버 없음, DB 없음, 유료 API 없음. 데이터는 localStorage에 저장.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'medimark_marketing_calendar_v1';
  var FILTER_KEY = 'medimark_marketing_filter_v1';

  var state = {
    calendar: [],
    filter: { channel: 'all', service: 'all', status: 'all', keyword: '' },
    editingId: null
  };

  // ── 저장/불러오기 ──
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      state.calendar = raw ? JSON.parse(raw) : seedCalendar();
    } catch (e) {
      state.calendar = seedCalendar();
    }
    try {
      var rawFilter = localStorage.getItem(FILTER_KEY);
      if (rawFilter) state.filter = JSON.parse(rawFilter);
    } catch (e) { /* ignore */ }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.calendar));
  }

  function saveFilter() {
    localStorage.setItem(FILTER_KEY, JSON.stringify(state.filter));
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── 헬퍼: 마스터 데이터 조회 ──
  function serviceOf(id) {
    return SERVICES.filter(function (s) { return s.id === id; })[0] || SERVICES[3];
  }
  function channelOf(id) {
    return CHANNELS.filter(function (c) { return c.id === id; })[0] || CHANNELS[0];
  }

  // ── 렌더링 ──
  function render() {
    renderFilterOptions();
    renderTable();
    renderStats();
    renderPerformance();
  }

  function renderFilterOptions() {
    var chSel = document.getElementById('filterChannel');
    var svcSel = document.getElementById('filterService');
    var stSel = document.getElementById('filterStatus');
    if (chSel.options.length <= 1) {
      CHANNELS.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.label;
        chSel.appendChild(opt);
      });
    }
    if (svcSel.options.length <= 1) {
      SERVICES.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.full;
        svcSel.appendChild(opt);
      });
    }
    if (stSel.options.length <= 1) {
      STATUSES.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        stSel.appendChild(opt);
      });
    }
    chSel.value = state.filter.channel;
    svcSel.value = state.filter.service;
    stSel.value = state.filter.status;
    document.getElementById('searchInput').value = state.filter.keyword || '';
  }

  function filteredCalendar() {
    var keyword = (state.filter.keyword || '').trim().toLowerCase();
    return state.calendar
      .filter(function (item) {
        if (state.filter.channel !== 'all' && item.channel !== state.filter.channel) return false;
        if (state.filter.service !== 'all' && item.service !== state.filter.service) return false;
        if (state.filter.status !== 'all' && item.status !== state.filter.status) return false;
        if (keyword && item.topic.toLowerCase().indexOf(keyword) === -1) return false;
        return true;
      })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  // ── 마감 지남/임박 판정 ──
  // '완료' 상태는 제외 — 이미 발행된 콘텐츠는 마감 표시가 필요 없음
  function dateFlag(item) {
    if (item.status === '완료') return null;
    var today = todayStr();
    if (item.date < today) return 'overdue';
    var soonLimit = addDays(today, 3);
    if (item.date <= soonLimit) return 'soon';
    return null;
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function renderTable() {
    var tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';
    var items = filteredCalendar();

    if (items.length === 0) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 10;
      tdEmpty.className = 'empty-row';
      tdEmpty.textContent = '조건에 맞는 콘텐츠가 없습니다. 필터를 바꾸거나 새 콘텐츠를 추가하세요.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    items.forEach(function (item) {
      var svc = serviceOf(item.service);
      var ch = channelOf(item.channel);
      var tr = document.createElement('tr');
      var flag = dateFlag(item);
      if (flag) tr.className = 'row-' + flag;

      var dateTd = document.createElement('td');
      dateTd.appendChild(document.createTextNode(item.date));
      if (flag) {
        var flagEl = document.createElement('span');
        flagEl.className = 'date-flag ' + flag;
        flagEl.textContent = flag === 'overdue' ? '마감 지남' : '마감 임박';
        dateTd.appendChild(flagEl);
      }
      tr.appendChild(dateTd);
      tr.appendChild(td(ch.label));

      var svcTd = td(svc.label);
      svcTd.innerHTML = '<span class="svc-badge" style="background:' + svc.color + '22;color:' + svc.color + ';border-color:' + svc.color + '55;">' + svc.label + '</span>';
      tr.appendChild(svcTd);

      var topicTd = document.createElement('td');
      topicTd.className = 'topic-cell';
      var topicSpan = document.createElement('span');
      topicSpan.className = 'topic-text';
      topicSpan.textContent = item.topic;
      topicSpan.title = item.topic;
      topicTd.appendChild(topicSpan);
      tr.appendChild(topicTd);

      var statusTd = td('');
      var statusSel = document.createElement('select');
      statusSel.className = 'status-select status-' + statusClass(item.status);
      STATUSES.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        if (s === item.status) opt.selected = true;
        statusSel.appendChild(opt);
      });
      statusSel.addEventListener('change', function () {
        item.status = statusSel.value;
        statusSel.className = 'status-select status-' + statusClass(item.status);
        save();
      });
      statusTd.appendChild(statusSel);
      tr.appendChild(statusTd);

      tr.appendChild(td(item.assignee || '—'));

      var draftTd = td('');
      draftTd.innerHTML = item.draft
        ? '<span class="draft-badge draft-ready">초안 있음</span>'
        : '<span class="draft-badge draft-none">초안 없음</span>';
      tr.appendChild(draftTd);

      tr.appendChild(numInputTd(item, 'views'));
      tr.appendChild(numInputTd(item, 'leads'));

      var actionTd = document.createElement('td');
      actionTd.className = 'action-cell';

      var promptBtn = document.createElement('button');
      promptBtn.className = 'btn btn-sm btn-primary';
      promptBtn.textContent = 'AI 프롬프트';
      promptBtn.addEventListener('click', function () { openPromptModal(item.id); });
      actionTd.appendChild(promptBtn);

      var sendBtn = document.createElement('button');
      sendBtn.className = 'btn btn-sm btn-outline';
      sendBtn.textContent = '채널 연동';
      sendBtn.addEventListener('click', function () { openChannelModal(item.id); });
      actionTd.appendChild(sendBtn);

      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-ghost';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', function () { openEditModal(item.id); });
      actionTd.appendChild(editBtn);

      var dupBtn = document.createElement('button');
      dupBtn.className = 'btn btn-sm btn-ghost';
      dupBtn.textContent = '복제';
      dupBtn.title = '반복되는 콘텐츠를 복제해서 날짜만 바꿔 재사용하세요 (다음 주 같은 요일로 자동 설정)';
      dupBtn.addEventListener('click', function () { duplicateItem(item.id); });
      actionTd.appendChild(dupBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-ghost btn-danger';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', function () { deleteItem(item.id); });
      actionTd.appendChild(delBtn);

      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
  }

  function statusClass(status) {
    var map = { '기획': 'plan', '생성중': 'making', '검수중': 'review', '예정': 'wait', '완료': 'done' };
    return map[status] || 'plan';
  }

  function td(text) {
    var el = document.createElement('td');
    el.textContent = text;
    return el;
  }

  function numInputTd(item, field) {
    var cell = document.createElement('td');
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.className = 'perf-input';
    input.value = item[field] || 0;
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      item[field] = isNaN(v) || v < 0 ? 0 : v;
      input.value = item[field];
      save();
      renderPerformance();
    });
    cell.appendChild(input);
    return cell;
  }

  function renderStats() {
    var total = state.calendar.length;
    var done = state.calendar.filter(function (i) { return i.status === '완료'; }).length;
    var withDraft = state.calendar.filter(function (i) { return !!i.draft; }).length;
    var byService = {};
    SERVICES.forEach(function (s) { byService[s.id] = 0; });
    state.calendar.forEach(function (i) { if (byService[i.service] !== undefined) byService[i.service]++; });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statDraft').textContent = withDraft;

    var byServiceEl = document.getElementById('statByService');
    byServiceEl.innerHTML = '';
    SERVICES.forEach(function (s) {
      var chip = document.createElement('span');
      chip.className = 'svc-chip';
      chip.style.borderColor = s.color + '55';
      chip.style.color = s.color;
      chip.textContent = s.label + ' ' + byService[s.id];
      byServiceEl.appendChild(chip);
    });
  }

  // ── 성과 요약 ──
  function pct(leads, views) {
    if (!views) return '—';
    return (leads / views * 100).toFixed(1) + '%';
  }

  function renderPerformance() {
    var totalViews = 0, totalLeads = 0;
    state.calendar.forEach(function (i) {
      totalViews += (i.views || 0);
      totalLeads += (i.leads || 0);
    });
    document.getElementById('perfViews').textContent = totalViews.toLocaleString();
    document.getElementById('perfLeads').textContent = totalLeads.toLocaleString();
    document.getElementById('perfRate').textContent = totalViews ? (totalLeads / totalViews * 100).toFixed(1) + '%' : '0%';

    renderPerfGroup('perfByService', SERVICES, function (i) { return i.service; }, function (s) { return s.full; });
    renderPerfGroup('perfByChannel', CHANNELS, function (i) { return i.channel; }, function (c) { return c.label; });
  }

  function renderPerfGroup(tbodyId, masterList, getKey, getLabel) {
    var tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    masterList.forEach(function (entry) {
      var items = state.calendar.filter(function (i) { return getKey(i) === entry.id; });
      if (items.length === 0) return;
      var views = 0, leads = 0;
      items.forEach(function (i) { views += (i.views || 0); leads += (i.leads || 0); });

      var tr = document.createElement('tr');
      tr.appendChild(td(getLabel(entry)));
      tr.appendChild(td(String(items.length)));
      tr.appendChild(td(views.toLocaleString()));
      tr.appendChild(td(leads.toLocaleString()));
      tr.appendChild(td(pct(leads, views)));
      tbody.appendChild(tr);
    });
    if (!tbody.children.length) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 5;
      tdEmpty.className = 'empty-row';
      tdEmpty.textContent = '아직 기록된 실적이 없습니다.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
    }
  }

  // ── CRUD ──
  function addItem(data) {
    data.id = uid();
    data.draft = '';
    data.views = 0;
    data.leads = 0;
    state.calendar.push(data);
    save();
    render();
  }

  function updateItem(id, patch) {
    var item = state.calendar.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    Object.keys(patch).forEach(function (k) { item[k] = patch[k]; });
    save();
    render();
  }

  function deleteItem(id) {
    if (!confirm('이 콘텐츠 항목을 삭제할까요?')) return;
    state.calendar = state.calendar.filter(function (i) { return i.id !== id; });
    save();
    render();
  }

  // 반복 콘텐츠(주간 시리즈 등)를 빠르게 재사용하기 위한 복제 — 날짜는 7일 뒤로,
  // 상태·초안·실적은 새로 시작하도록 초기화합니다.
  function duplicateItem(id) {
    var item = state.calendar.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    var copy = {
      id: uid(),
      date: addDays(item.date, 7),
      channel: item.channel,
      service: item.service,
      topic: item.topic,
      status: '기획',
      assignee: item.assignee,
      draft: '',
      views: 0,
      leads: 0
    };
    state.calendar.push(copy);
    save();
    render();
  }

  // ── 새 콘텐츠 / 수정 모달 ──
  function openEditModal(id) {
    var item = id ? state.calendar.filter(function (i) { return i.id === id; })[0] : null;
    state.editingId = id || null;

    document.getElementById('editDate').value = item ? item.date : todayStr();
    fillSelect('editChannel', CHANNELS, 'id', 'label', item ? item.channel : CHANNELS[0].id);
    fillSelect('editService', SERVICES, 'id', 'full', item ? item.service : SERVICES[0].id);
    fillSelect('editStatus', STATUSES.map(function (s) { return { id: s, label: s }; }), 'id', 'label', item ? item.status : '기획');
    document.getElementById('editTopic').value = item ? item.topic : '';
    document.getElementById('editAssignee').value = item ? item.assignee : '';
    document.getElementById('editModalTitle').textContent = item ? '콘텐츠 수정' : '새 콘텐츠 추가';

    showModal('editModal');
  }

  function fillSelect(elId, list, valueKey, labelKey, selected) {
    var sel = document.getElementById(elId);
    sel.innerHTML = '';
    list.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[valueKey];
      opt.textContent = o[labelKey];
      if (o[valueKey] === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function todayStr() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function submitEditModal() {
    var data = {
      date: document.getElementById('editDate').value || todayStr(),
      channel: document.getElementById('editChannel').value,
      service: document.getElementById('editService').value,
      status: document.getElementById('editStatus').value,
      topic: document.getElementById('editTopic').value.trim(),
      assignee: document.getElementById('editAssignee').value.trim()
    };
    if (!data.topic) {
      alert('콘텐츠 주제를 입력해주세요.');
      return;
    }
    if (state.editingId) {
      updateItem(state.editingId, data);
    } else {
      addItem(data);
    }
    hideModal('editModal');
  }

  // ── AI 프롬프트 생성 모달 ──
  var promptTargetId = null;

  function openPromptModal(id) {
    var item = state.calendar.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    promptTargetId = id;

    var prompt = buildPrompt(item.channel, item.service, item.topic);
    document.getElementById('promptText').value = prompt;
    document.getElementById('promptModalSub').textContent =
      channelOf(item.channel).label + ' · ' + serviceOf(item.service).full + ' · ' + item.topic;
    document.getElementById('draftText').value = item.draft || '';
    setGenStatus(null);

    showModal('promptModal');
  }

  function copyPromptText() {
    var ta = document.getElementById('promptText');
    ta.select();
    copyToClipboard(ta.value, function () {
      flashCopied('promptCopyBtn');
    });
  }

  // ── Gemini 완전 자동 생성 / 품질 다듬기 (공통 호출부) ──
  // 서버(Netlify Function)에 GEMINI_API_KEY가 등록되어 있으면 프롬프트를 그대로 보내
  // 콘텐츠를 자동 생성해 draftText에 채워줍니다. 미등록 상태(501)면 기존처럼
  // "복사 → 무료 채팅에 붙여넣기" 흐름을 안내합니다.
  function callGemini(promptValue, btn, progressLabel, successMessage) {
    if (!promptValue) return;

    btn.disabled = true;
    var originalLabel = btn.textContent;
    btn.textContent = progressLabel;
    setGenStatus('Gemini에 요청 중입니다...', 'info');

    fetch('/.netlify/functions/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptValue })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (result) {
        if (result.status === 501) {
          setGenStatus(
            '아직 Gemini API 키가 등록되지 않았습니다. 관리자가 Netlify 환경변수(GEMINI_API_KEY)를 ' +
            '등록하면 이 버튼으로 바로 생성됩니다. 그 전까지는 위 "프롬프트 복사" 버튼으로 ChatGPT/Claude에 ' +
            '붙여넣어 사용해주세요.',
            'info'
          );
          return;
        }
        if (!result.data || !result.data.ok) {
          setGenStatus('자동 생성에 실패했습니다. 잠시 후 다시 시도하거나, 프롬프트를 복사해 직접 붙여넣어주세요.', 'error');
          return;
        }
        document.getElementById('draftText').value = result.data.text;
        setGenStatus(successMessage, 'ok');
      })
      .catch(function () {
        setGenStatus('네트워크 오류로 자동 생성에 실패했습니다. 프롬프트를 복사해 직접 붙여넣어 사용해주세요.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = originalLabel;
      });
  }

  function generateWithGemini() {
    var btn = document.getElementById('geminiGenBtn');
    var promptValue = document.getElementById('promptText').value;
    callGemini(promptValue, btn, '생성 중...', 'Gemini 자동 생성 완료. 내용을 확인한 뒤 "초안 저장"을 눌러주세요.');
  }

  // ── 콘텐츠 품질 다듬기 버튼 (다시 생성 / 더 짧게 / 더 신뢰감 있게) ──
  // draftText에 이미 채워진 초안을 대상으로 Gemini에게 재작성을 요청합니다.
  // "다시 생성"은 원래 프롬프트를 그대로 재요청해 새로운 버전을 받습니다.
  var REFINE_BTN_IDS = { regen: 'refineRegenBtn', shorter: 'refineShorterBtn', trust: 'refineTrustBtn' };

  function refineDraft(mode) {
    var promptValue = document.getElementById('promptText').value;
    var draftValue = document.getElementById('draftText').value.trim();

    if (mode !== 'regen' && !draftValue) {
      alert('먼저 초안을 생성하거나 직접 입력해주세요.');
      return;
    }

    var instruction = promptValue;
    var progressLabel = '다시 생성 중...';
    if (mode === 'shorter') {
      instruction = '다음 문구를 더 짧고 간결하게 다듬어줘. 핵심 내용과 원래 톤은 유지해줘. ' +
        '결과만 출력하고 별도 설명은 붙이지 마.\n\n' + draftValue;
      progressLabel = '다듬는 중...';
    } else if (mode === 'trust') {
      instruction = '다음 문구를 더 신뢰감 있고 차분한 톤으로 다듬어줘. 과장되거나 자극적인 표현은 빼줘. ' +
        '결과만 출력하고 별도 설명은 붙이지 마.\n\n' + draftValue;
      progressLabel = '다듬는 중...';
    }

    var btn = document.getElementById(REFINE_BTN_IDS[mode]);
    callGemini(instruction, btn, progressLabel, '다듬기 완료. 내용을 확인한 뒤 "초안 저장"을 눌러주세요.');
  }

  function setGenStatus(message, level) {
    var el = document.getElementById('geminiStatus');
    if (!message) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = message;
    el.className = 'gen-status gen-status-' + (level || 'info');
  }

  function saveDraft() {
    if (!promptTargetId) return;
    var draft = document.getElementById('draftText').value;
    updateItem(promptTargetId, { draft: draft });
    hideModal('promptModal');
  }

  // ── 채널 연동(반자동) 모달 ──
  var channelTargetId = null;

  function openChannelModal(id) {
    var item = state.calendar.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    channelTargetId = id;

    var ch = channelOf(item.channel);
    document.getElementById('channelModalSub').textContent = ch.label + ' · ' + item.topic;
    document.getElementById('channelPublishText').value = item.draft ||
      '(아직 초안이 없습니다. "AI 프롬프트" 버튼으로 먼저 콘텐츠를 만들어주세요.)';

    var openUrl = getChannelOpenUrl(item.channel);
    var openLink = document.getElementById('channelOpenLink');
    openLink.href = openUrl;
    openLink.textContent = ch.label + ' 열기 (' + openUrl.replace(/^https?:\/\//, '') + ')';

    var note = document.getElementById('channelNote');
    note.textContent = ch.id === 'youtube'
      ? '유튜브는 영상 업로드 자체가 필요해 "복사"는 설명란/제목 문구용입니다.'
      : ch.id === 'cardnews'
      ? '카드뉴스는 이미지 제작이 필요해 반자동입니다. 아래 슬라이드별 문구를 복사해 Canva 템플릿에 붙여넣어 디자인을 완성한 뒤, 완성된 이미지를 인스타그램 등에 게시해주세요.'
      : '현재는 API 자동 게시가 준비되기 전이라, 아래 내용을 복사한 뒤 채널을 열어 직접 붙여넣는 반자동 방식입니다.';

    showModal('channelModal');
  }

  function copyChannelText() {
    var ta = document.getElementById('channelPublishText');
    copyToClipboard(ta.value, function () {
      flashCopied('channelCopyBtn');
    });
  }

  // ── 클립보드 유틸 ──
  function copyToClipboard(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, function () { fallbackCopy(text, onDone); });
    } else {
      fallbackCopy(text, onDone);
    }
  }

  function fallbackCopy(text, onDone) {
    var el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus(); el.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(el);
    if (onDone) onDone();
  }

  function flashCopied(btnId) {
    var btn = document.getElementById(btnId);
    var original = btn.textContent;
    btn.textContent = '✓ 복사됨';
    btn.disabled = true;
    setTimeout(function () { btn.textContent = original; btn.disabled = false; }, 1600);
  }

  // ── 모달 공통 ──
  function showModal(id) {
    document.getElementById(id).classList.add('open');
  }
  function hideModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  // ── 데이터 내보내기/가져오기 ──
  function exportData() {
    var blob = new Blob([JSON.stringify(state.calendar, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'medimark-content-calendar-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('invalid format');
        state.calendar = data;
        save();
        render();
        alert('가져오기 완료: ' + data.length + '건');
      } catch (e) {
        alert('파일을 읽을 수 없습니다. JSON 내보내기 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  }

  // ── 이벤트 바인딩 ──
  function bindEvents() {
    document.getElementById('filterChannel').addEventListener('change', function (e) {
      state.filter.channel = e.target.value; saveFilter(); renderTable();
    });
    document.getElementById('filterService').addEventListener('change', function (e) {
      state.filter.service = e.target.value; saveFilter(); renderTable();
    });
    document.getElementById('filterStatus').addEventListener('change', function (e) {
      state.filter.status = e.target.value; saveFilter(); renderTable();
    });
    document.getElementById('searchInput').addEventListener('input', function (e) {
      state.filter.keyword = e.target.value; saveFilter(); renderTable();
    });

    document.getElementById('addBtn').addEventListener('click', function () { openEditModal(null); });
    document.getElementById('editCancelBtn').addEventListener('click', function () { hideModal('editModal'); });
    document.getElementById('editSaveBtn').addEventListener('click', submitEditModal);

    document.getElementById('promptCloseBtn').addEventListener('click', function () { hideModal('promptModal'); });
    document.getElementById('promptCopyBtn').addEventListener('click', copyPromptText);
    document.getElementById('geminiGenBtn').addEventListener('click', generateWithGemini);
    document.getElementById('refineRegenBtn').addEventListener('click', function () { refineDraft('regen'); });
    document.getElementById('refineShorterBtn').addEventListener('click', function () { refineDraft('shorter'); });
    document.getElementById('refineTrustBtn').addEventListener('click', function () { refineDraft('trust'); });
    document.getElementById('draftSaveBtn').addEventListener('click', saveDraft);

    document.getElementById('channelCloseBtn').addEventListener('click', function () { hideModal('channelModal'); });
    document.getElementById('channelCopyBtn').addEventListener('click', copyChannelText);

    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });

    document.querySelectorAll('.modal-backdrop').forEach(function (bd) {
      bd.addEventListener('click', function (e) {
        if (e.target === bd) bd.classList.remove('open');
      });
    });
  }

  // ── 시작 ──
  document.addEventListener('DOMContentLoaded', function () {
    load();
    bindEvents();
    render();
  });
})();
