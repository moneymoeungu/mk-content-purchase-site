document.addEventListener("DOMContentLoaded", function () {
  var APPS_SCRIPT_FALLBACK_URL = "https://script.google.com/macros/s/AKfycbx6XwLC7NXJx5qnaRWcpgL9VYlX45qW19lIvPvOZwmDH4H4XnOz0sn0vihbYvDtRXLzHw/exec";

  var PURPOSE_SUB_OPTIONS = {
    "방송": ["TV/OTT", "유튜브", "영화"],
    "출판": ["도서", "학술지, 교과서 등"],
    "온라인 게재": ["홈페이지", "SNS(블로그, 인스타그램, 페이스북)", "뉴스레터", "사내 인트라넷"],
    "광고/홍보": ["오프라인 광고 소재 제작", "인쇄물(팜플렛, 브로슈어 등)", "전시회 활용"],
    "기타": ["내부 보고자료", "연구 데이터 활용", "기타"]
  };

  function formatWon(n) {
    return Number(n || 0).toLocaleString("ko-KR") + "원";
  }

  // ── 1. 탭(Tab) 전환 제어 ──────────────────────────────
  var tabButtons = document.querySelectorAll(".form-tab");
  var panelApp = document.getElementById("tab-panel-application");
  var panelInq = document.getElementById("tab-panel-inquiry");

  function switchTab(targetName) {
    tabButtons.forEach(function (btn) {
      var isMatch = btn.getAttribute("data-tab-target") === targetName;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-selected", isMatch ? "true" : "false");
    });
    if (panelApp) panelApp.classList.toggle("hidden", targetName !== "application");
    if (panelInq) panelInq.classList.toggle("hidden", targetName !== "inquiry");
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.getAttribute("data-tab-target"));
    });
  });

  document.querySelectorAll("[data-tab-link]").forEach(function (link) {
    link.addEventListener("click", function () {
      switchTab(link.getAttribute("data-tab-link"));
    });
  });

  // ── 2. 세부 용도 추천 칩(Chip) 렌더링 ──────────────────────────────
  function renderDetailChips(containerId, category, inputEl) {
    var container = document.getElementById(containerId);
    if (!container || !inputEl) return;
    var list = PURPOSE_SUB_OPTIONS[category] || [];
    if (!list.length) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }
    container.innerHTML = "";
    list.forEach(function (label) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "detail-chip" + (inputEl.value.trim() === label ? " active" : "");
      chip.textContent = label;
      chip.addEventListener("click", function () {
        inputEl.value = label;
        container.querySelectorAll(".detail-chip").forEach(function (c) {
          c.classList.toggle("active", c === chip);
        });
      });
      container.appendChild(chip);
    });
    container.classList.remove("hidden");
  }

  var appPurposeRadios = document.querySelectorAll('input[name="appPurposeCategory"]');
  var appPurposeDetailInput = document.getElementById("appPurposeDetail");
  appPurposeRadios.forEach(function (r) {
    r.addEventListener("change", function () {
      if (r.checked) {
        renderDetailChips("app-detail-chips", r.value, appPurposeDetailInput);
      }
    });
  });

  var inqPurposeSelect = document.getElementById("purposeCategory");
  var inqPurposeDetailInput = document.getElementById("purposeDetail");
  if (inqPurposeSelect) {
    inqPurposeSelect.addEventListener("change", function () {
      renderDetailChips("inq-detail-chips", inqPurposeSelect.value, inqPurposeDetailInput);
    });
  }

  // ── 3. 구매 기사 목록 관리 (신청서) ──────────────────────────────
  function setupArticleList() {
    var list = document.getElementById("article-list");
    var addBtn = document.getElementById("article-add-btn");
    if (!list || !addBtn) return null;

    function renumber() {
      var rows = list.querySelectorAll(".article-row");
      rows.forEach(function (row, i) {
        row.querySelector(".article-row-num").textContent = "기사 " + (i + 1);
        row.querySelector(".article-remove-btn").classList.toggle("hidden", rows.length <= 1);
      });
    }

    function addRow() {
      var row = document.createElement("div");
      row.className = "article-row";
      row.innerHTML =
        '<div class="article-row-head">' +
          '<span class="article-row-num"></span>' +
          '<button type="button" class="article-remove-btn hidden" aria-label="이 기사 삭제">삭제 ×</button>' +
        '</div>' +
        '<div class="form-row-split">' +
          '<div><label>기사제목 <span class="required">*</span></label><input type="text" class="art-title" placeholder="기사 원문 제목을 입력해주세요"></div>' +
          '<div><label>기사URL <span class="required">*</span></label><input type="url" class="art-url" placeholder="https://www.mk.co.kr/..."></div>' +
        '</div>' +
        '<div class="form-row-split">' +
          '<div><label>기사날짜 <span class="required">*</span></label><input type="date" class="art-date"></div>' +
          '<div><label>사진 포함 여부 / 순번</label><input type="text" class="art-photo" value="해당없음(텍스트만)" placeholder="예: 1번째 사진 또는 해당없음"></div>' +
        '</div>';
      row.querySelector(".article-remove-btn").addEventListener("click", function () {
        row.remove();
        renumber();
      });
      list.appendChild(row);
      renumber();
    }

    function setRowCount(targetCount) {
      var count = Math.max(1, Math.min(20, Number(targetCount) || 1));
      var currentRows = list.querySelectorAll(".article-row");
      if (currentRows.length < count) {
        for (var i = currentRows.length; i < count; i++) {
          addRow();
        }
      } else if (currentRows.length > count) {
        for (var j = currentRows.length - 1; j >= count; j--) {
          var r = currentRows[j];
          var hasVal = r.querySelector(".art-title").value.trim() || r.querySelector(".art-url").value.trim();
          if (!hasVal) r.remove();
        }
        renumber();
      }
    }

    addBtn.addEventListener("click", addRow);
    addRow();

    function collect(missing) {
      var rows = list.querySelectorAll(".article-row");
      var articles = [];
      var hasInvalid = false;
      rows.forEach(function (row) {
        row.classList.remove("field-invalid");
        var title = row.querySelector(".art-title").value.trim();
        var url = row.querySelector(".art-url").value.trim();
        var date = row.querySelector(".art-date").value.trim();
        var photo = row.querySelector(".art-photo").value.trim() || "해당없음";
        if (!title || !url || !date) {
          row.classList.add("field-invalid");
          hasInvalid = true;
        }
        articles.push({ title: title, url: url, date: date, photoIndex: photo });
      });
      if (hasInvalid) {
        missing.push("구매 기사 정보(제목·URL·날짜)");
      }
      return articles;
    }

    function reset() {
      list.innerHTML = "";
      addRow();
    }

    return { collect: collect, reset: reset, setRowCount: setRowCount };
  }

  var articleList = setupArticleList();

  // ── 4. 가격표 인터랙션 & 실시간 견적 계산기 ──────────────────────────────
  var priceRows = document.querySelectorAll(".price-row");
  var calcSelectedLabel = document.getElementById("calc-selected-label");
  var calcCountInput = document.getElementById("calc-count");
  var calcMinusBtn = document.getElementById("calc-qty-minus");
  var calcPlusBtn = document.getElementById("calc-qty-plus");
  var calcOptPdf = document.getElementById("calc-opt-pdf");
  var calcOptAcademic = document.getElementById("calc-opt-academic");
  var calcTotalPrice = document.getElementById("calc-total-price");
  var calcVatPrice = document.getElementById("calc-vat-price");
  var calcOptionWarn = document.getElementById("calc-option-warn");
  var calcApplyBtn = document.getElementById("calc-apply-btn");
  var calcInquireBtn = document.getElementById("calc-inquire-btn");

  var calcState = {
    category: "온라인 게재",
    detail: "홈페이지",
    unitPrice: 300000
  };

  function updateCalculator() {
    if (!calcTotalPrice) return;
    var count = Math.max(1, parseInt(calcCountInput.value, 10) || 1);
    calcCountInput.value = count;

    var base = calcState.unitPrice;
    var useAcademic = calcOptAcademic && calcOptAcademic.checked;
    var usePdf = calcOptPdf && calcOptPdf.checked;
    var warnMessages = [];

    if (usePdf && (useAcademic || calcState.category === "광고/홍보")) {
      warnMessages.push("※ 학술 연구 목적 또는 광고/홍보 용도는 지면 PDF 제공이 불가합니다.");
      usePdf = false;
    }

    var unitAfterDiscount = useAcademic ? Math.round(base * 0.5) : base;
    var unitWithPdf = unitAfterDiscount + (usePdf ? 300000 : 0);
    var total = unitWithPdf * count;
    var totalVat = Math.round(total * 1.1);

    calcSelectedLabel.textContent =
      "선택됨: [" + calcState.category + "] " + calcState.detail + " (기본 단가 " + formatWon(base) + ")";
    calcTotalPrice.textContent = formatWon(total);
    calcVatPrice.textContent = "VAT 포함 시 " + formatWon(totalVat) + " (" + count + "건 기준)";

    if (calcOptionWarn) {
      if (warnMessages.length) {
        calcOptionWarn.textContent = warnMessages.join(" ");
        calcOptionWarn.classList.remove("hidden");
      } else {
        calcOptionWarn.classList.add("hidden");
      }
    }
  }

  priceRows.forEach(function (row) {
    row.addEventListener("click", function () {
      priceRows.forEach(function (r) {
        r.classList.remove("selected");
        var btn = r.querySelector(".btn-row-select");
        if (btn) btn.textContent = "선택";
      });
      row.classList.add("selected");
      var selectBtn = row.querySelector(".btn-row-select");
      if (selectBtn) selectBtn.textContent = "선택됨";

      calcState.category = row.getAttribute("data-category");
      calcState.detail = row.getAttribute("data-detail");
      calcState.unitPrice = parseInt(row.getAttribute("data-price"), 10) || 0;

      if (calcState.detail.indexOf("학술") !== -1 && calcOptAcademic) {
        calcOptAcademic.checked = false;
      }
      updateCalculator();
    });
  });

  if (calcMinusBtn) {
    calcMinusBtn.addEventListener("click", function () {
      calcCountInput.value = Math.max(1, (parseInt(calcCountInput.value, 10) || 1) - 1);
      updateCalculator();
    });
  }
  if (calcPlusBtn) {
    calcPlusBtn.addEventListener("click", function () {
      calcCountInput.value = Math.min(99, (parseInt(calcCountInput.value, 10) || 1) + 1);
      updateCalculator();
    });
  }
  if (calcCountInput) calcCountInput.addEventListener("input", updateCalculator);
  if (calcOptPdf) calcOptPdf.addEventListener("change", updateCalculator);
  if (calcOptAcademic) calcOptAcademic.addEventListener("change", updateCalculator);

  function buildSpecialNoteFromCalc() {
    var notes = [];
    if (calcOptPdf && calcOptPdf.checked && !(calcOptAcademic && calcOptAcademic.checked) && calcState.category !== "광고/홍보") {
      notes.push("지면 PDF 파일 제공 요청 (+300,000원/건)");
    }
    if (calcOptAcademic && calcOptAcademic.checked) {
      notes.push("학술 연구 목적 정식 계약 신청 (50% 할인 적용 대상)");
    }
    return notes.join(", ");
  }

  if (calcApplyBtn) {
    calcApplyBtn.addEventListener("click", function () {
      switchTab("application");
      appPurposeRadios.forEach(function (r) {
        r.checked = r.value === calcState.category;
      });
      if (appPurposeDetailInput) {
        appPurposeDetailInput.value = calcState.detail;
        renderDetailChips("app-detail-chips", calcState.category, appPurposeDetailInput);
      }
      var noteEl = document.getElementById("appSpecialNote");
      var autoNote = buildSpecialNoteFromCalc();
      if (noteEl && autoNote) noteEl.value = autoNote;

      var count = Math.max(1, parseInt(calcCountInput.value, 10) || 1);
      if (articleList) articleList.setRowCount(count);

      var formsSection = document.getElementById("forms-section");
      if (formsSection) formsSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (calcInquireBtn) {
    calcInquireBtn.addEventListener("click", function () {
      switchTab("inquiry");
      if (inqPurposeSelect) {
        inqPurposeSelect.value = calcState.category;
      }
      if (inqPurposeDetailInput) {
        inqPurposeDetailInput.value = calcState.detail;
        renderDetailChips("inq-detail-chips", calcState.category, inqPurposeDetailInput);
      }
      var inqNote = document.getElementById("specialNote");
      var autoNote = buildSpecialNoteFromCalc();
      if (inqNote && autoNote) inqNote.value = autoNote;

      var formsSection = document.getElementById("forms-section");
      if (formsSection) formsSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  // 초기 기본 행 선택 표시 (온라인 게재 - 홈페이지)
  priceRows.forEach(function (r) {
    if (r.getAttribute("data-category") === "온라인 게재" && r.getAttribute("data-detail") === "홈페이지") {
      r.classList.add("selected");
      var btn = r.querySelector(".btn-row-select");
      if (btn) btn.textContent = "선택됨";
    }
  });
  updateCalculator();

  // ── 5. 입력 편의성 (자동 하이픈 & 이메일 동기화) ──────────────────────────────
  var bizInput = document.getElementById("appBizRegNo");
  if (bizInput) {
    bizInput.addEventListener("input", function () {
      var digits = bizInput.value.replace(/\D/g, "").slice(0, 10);
      if (digits.length <= 3) {
        bizInput.value = digits;
      } else if (digits.length <= 5) {
        bizInput.value = digits.slice(0, 3) + "-" + digits.slice(3);
      } else {
        bizInput.value = digits.slice(0, 3) + "-" + digits.slice(3, 5) + "-" + digits.slice(5);
      }
    });
  }

  var phoneInput = document.getElementById("appPhone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      var digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
      if (digits.indexOf("02") === 0) {
        if (digits.length <= 2) phoneInput.value = digits;
        else if (digits.length <= 5) phoneInput.value = digits.slice(0, 2) + "-" + digits.slice(2);
        else if (digits.length <= 9) phoneInput.value = digits.slice(0, 2) + "-" + digits.slice(2, 5) + "-" + digits.slice(5);
        else phoneInput.value = digits.slice(0, 2) + "-" + digits.slice(2, 6) + "-" + digits.slice(6, 10);
      } else {
        if (digits.length <= 3) phoneInput.value = digits;
        else if (digits.length <= 6) phoneInput.value = digits.slice(0, 3) + "-" + digits.slice(3);
        else if (digits.length <= 10) phoneInput.value = digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
        else phoneInput.value = digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7, 11);
      }
    });
  }

  var sameEmailCheck = document.getElementById("same-as-app-email");
  var appEmailInput = document.getElementById("appEmail");
  var taxEmailInput = document.getElementById("appTaxInvoiceEmail");
  if (sameEmailCheck && appEmailInput && taxEmailInput) {
    sameEmailCheck.addEventListener("change", function () {
      if (sameEmailCheck.checked) {
        taxEmailInput.value = appEmailInput.value.trim();
      }
    });
    appEmailInput.addEventListener("input", function () {
      if (sameEmailCheck.checked) {
        taxEmailInput.value = appEmailInput.value.trim();
      }
    });
    taxEmailInput.addEventListener("input", function () {
      if (sameEmailCheck.checked && taxEmailInput.value.trim() !== appEmailInput.value.trim()) {
        sameEmailCheck.checked = false;
      }
    });
  }

  // ── 6. 폼 제출 및 Google Sheets 연동 (로컬 서버 + Serverless 폴백 지원) ──────────
  function showPdfDownload(linkId, base64, fileName) {
    var link = document.getElementById(linkId);
    if (!link) return;
    var byteChars = atob(base64);
    var byteNumbers = new Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    var blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    link.href = URL.createObjectURL(blob);
    link.download = fileName || "신청서.pdf";
    link.classList.remove("hidden");
  }

  function postWithFallback(endpoint, payload) {
    var isGitHubPages = window.location.hostname.indexOf("github.io") !== -1;

    function sendDirectToAppsScript() {
      return fetch(APPS_SCRIPT_FALLBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(function (res2) {
        if (!res2.ok) throw new Error("Google Sheets 연동 서버 응답 오류");
        return res2.json();
      });
    }

    if (isGitHubPages) {
      return sendDirectToAppsScript();
    }

    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("LocalEndpointUnavailable");
        return res.json();
      })
      .catch(function (err) {
        if (err.message !== "LocalEndpointUnavailable" && err.name !== "TypeError") {
          throw err;
        }
        return sendDirectToAppsScript();
      });
  }

  function setupForm(config) {
    var form = document.getElementById(config.formId);
    if (!form) return;
    var successBox = document.getElementById(config.successId);
    var errorBox = document.getElementById(config.errorId);
    var resetBtn = document.getElementById(config.resetId);
    var syncStatusEl = config.syncStatusId ? document.getElementById(config.syncStatusId) : null;

    function clearInvalid() {
      form.querySelectorAll(".field-invalid").forEach(function (el) {
        el.classList.remove("field-invalid");
      });
    }

    function markInvalid(fieldName) {
      var el = form.elements[fieldName];
      var target = el.closest ? el : el[0];
      target.closest(".form-row").classList.add("field-invalid");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errorBox.classList.add("hidden");
      clearInvalid();

      var payload = Object.assign({}, config.extraPayload || {});
      var missing = [];

      config.fields.forEach(function (f) {
        var value = form.elements[f.name].value.trim();
        payload[f.payloadKey || f.name] = value;
        if (f.required && !value) {
          markInvalid(f.name);
          missing.push(f.label);
        }
      });

      if (config.customFields) {
        var customResult = config.customFields(missing);
        Object.assign(payload, customResult);
      }

      if (missing.length > 0) {
        errorBox.textContent = "필수 항목을 입력해주세요: " + missing.join(", ");
        errorBox.classList.remove("hidden");
        return;
      }

      if (config.transformPayload) {
        config.transformPayload(payload);
      }

      var submitBtn = form.querySelector(".btn-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "접수 및 구글 시트 동기화 중...";

      postWithFallback(config.endpoint, payload)
        .then(function (result) {
          if (result && result.success === false) {
            throw new Error(result.error || "처리 중 오류가 발생했습니다.");
          }
          form.classList.add("hidden");
          successBox.classList.remove("hidden");
          if (syncStatusEl) {
            syncStatusEl.textContent = "✓ Google 스프레드시트 적재 및 담당자 알림 발송이 완료되었습니다.";
          }
          if (config.pdfDownloadId && result && result.pdfBase64) {
            showPdfDownload(config.pdfDownloadId, result.pdfBase64, result.pdfFileName);
          }
        })
        .catch(function (err) {
          errorBox.textContent = "제출에 실패했습니다. 잠시 후 다시 시도해주세요. (" + err.message + ")";
          errorBox.classList.remove("hidden");
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = config.submitText;
        });
    });

    resetBtn.addEventListener("click", function () {
      form.reset();
      clearInvalid();
      form.classList.remove("hidden");
      successBox.classList.add("hidden");
      if (config.pdfDownloadId) {
        var link = document.getElementById(config.pdfDownloadId);
        if (link && link.href) {
          URL.revokeObjectURL(link.href);
          link.removeAttribute("href");
        }
        if (link) link.classList.add("hidden");
      }
      if (config.onReset) config.onReset();
    });
  }

  setupForm({
    formId: "inquiry-form",
    successId: "inquiry-success",
    errorId: "inquiry-error",
    resetId: "inquiry-reset",
    syncStatusId: "inquiry-sync-status",
    endpoint: "/api/inquiry",
    submitText: "문의 제출하기",
    fields: [
      { name: "articleUrl", label: "기사 링크", required: true },
      { name: "purposeCategory", label: "사용 목적", required: true },
      { name: "purposeDetail", label: "세부 용도", required: true },
      { name: "specialNote", label: "특이사항", required: false },
      { name: "etcInquiry", label: "기타 문의", required: false },
      { name: "companyName", label: "회사명", required: true },
      { name: "managerName", label: "담당자명", required: false },
      { name: "contact", label: "이메일 또는 연락처", required: true }
    ],
    onReset: function () {
      var chips = document.getElementById("inq-detail-chips");
      if (chips) chips.classList.add("hidden");
    }
  });

  setupForm({
    formId: "application-form",
    successId: "application-success",
    errorId: "application-error",
    resetId: "application-reset",
    syncStatusId: "application-sync-status",
    endpoint: "/api/application",
    submitText: "신청서 제출하기",
    extraPayload: { formType: "application" },
    pdfDownloadId: "application-pdf-download",
    fields: [
      { name: "appCompanyName", payloadKey: "companyName", label: "법인명", required: true },
      { name: "appBizRegNo", payloadKey: "bizRegNo", label: "사업자등록번호", required: true },
      { name: "appAddress", payloadKey: "address", label: "주소", required: true },
      { name: "appPhone", payloadKey: "phone", label: "전화번호", required: true },
      { name: "appManagerName", payloadKey: "managerName", label: "담당자명", required: true },
      { name: "appEmail", payloadKey: "email", label: "담당자 e-mail", required: true },
      { name: "appPurposeCategory", payloadKey: "purposeCategory", label: "사용목적", required: true },
      { name: "appPurposeDetail", payloadKey: "purposeDetail", label: "사용목적 상세", required: true },
      { name: "appSpecialNote", payloadKey: "specialNote", label: "특이사항", required: false },
      { name: "appTaxInvoiceEmail", payloadKey: "taxInvoiceEmail", label: "세금계산서 수신 메일", required: true }
    ],
    customFields: function (missing) {
      return { articles: articleList ? articleList.collect(missing) : [] };
    },
    transformPayload: function (payload) {
      payload.purpose = payload.purposeCategory + " - " + payload.purposeDetail;
      delete payload.purposeCategory;
      delete payload.purposeDetail;
    },
    onReset: function () {
      if (articleList) articleList.reset();
      var chips = document.getElementById("app-detail-chips");
      if (chips) chips.classList.add("hidden");
    }
  });
});
