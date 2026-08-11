document.addEventListener("DOMContentLoaded", function () {

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

  function setupForm(config) {
    var form = document.getElementById(config.formId);
    if (!form) return;
    var successBox = document.getElementById(config.successId);
    var errorBox = document.getElementById(config.errorId);
    var resetBtn = document.getElementById(config.resetId);

    function clearInvalid() {
      form.querySelectorAll(".field-invalid").forEach(function (el) {
        el.classList.remove("field-invalid");
      });
    }

    function markInvalid(fieldName) {
      var el = form.elements[fieldName];
      var target = el.closest ? el : el[0]; // 라디오 그룹은 RadioNodeList라 첫 요소 기준으로 찾음
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
      submitBtn.textContent = "제출 중...";

      fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("서버 오류가 발생했습니다.");
          return res.json();
        })
        .then(function (result) {
          if (result && result.success === false) {
            throw new Error(result.error || "처리 중 오류가 발생했습니다.");
          }
          form.classList.add("hidden");
          successBox.classList.remove("hidden");
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
          '<button type="button" class="article-remove-btn hidden" aria-label="이 기사 삭제">×</button>' +
        '</div>' +
        '<div class="form-row-split">' +
          '<div><label>기사제목</label><input type="text" class="art-title"></div>' +
          '<div><label>기사URL</label><input type="url" class="art-url" placeholder="https://www.mk.co.kr/..."></div>' +
        '</div>' +
        '<div class="form-row-split">' +
          '<div><label>기사날짜</label><input type="text" class="art-date" placeholder="예: 2026-01-15"></div>' +
          '<div><label>사진 순번</label><input type="text" class="art-photo" placeholder="사진인 경우 몇 번째 사진인지"></div>' +
        '</div>';
      row.querySelector(".article-remove-btn").addEventListener("click", function () {
        row.remove();
        renumber();
      });
      list.appendChild(row);
      renumber();
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
        var photo = row.querySelector(".art-photo").value.trim();
        if (!title || !url || !date || !photo) {
          row.classList.add("field-invalid");
          hasInvalid = true;
        }
        articles.push({ title: title, url: url, date: date, photoIndex: photo });
      });
      if (hasInvalid) {
        missing.push("구매 기사 정보(각 항목 모두 입력)");
      }
      return articles;
    }

    function reset() {
      list.innerHTML = "";
      addRow();
    }

    return { collect: collect, reset: reset };
  }

  var articleList = setupArticleList();

  setupForm({
    formId: "inquiry-form",
    successId: "inquiry-success",
    errorId: "inquiry-error",
    resetId: "inquiry-reset",
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
    ]
  });

  setupForm({
    formId: "application-form",
    successId: "application-success",
    errorId: "application-error",
    resetId: "application-reset",
    endpoint: "/api/application",
    submitText: "신청서 제출하기",
    extraPayload: { formType: "application" },
    pdfDownloadId: "application-pdf-download",
    fields: [
      { name: "appCompanyName", payloadKey: "companyName", label: "법인명", required: true },
      { name: "appBizRegNo", payloadKey: "bizRegNo", label: "사업자등록번호", required: true },
      { name: "appAddress", payloadKey: "address", label: "주소", required: true },
      { name: "appPhone", payloadKey: "phone", label: "전화", required: true },
      { name: "appManagerName", payloadKey: "managerName", label: "담당자명", required: true },
      { name: "appEmail", payloadKey: "email", label: "e-mail", required: true },
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
    }
  });

});
