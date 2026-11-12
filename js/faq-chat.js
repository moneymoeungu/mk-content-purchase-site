document.addEventListener("DOMContentLoaded", function () {
  var toggleBtn = document.getElementById("faq-chat-toggle");
  var panel = document.getElementById("faq-chat-panel");
  var closeBtn = document.getElementById("faq-chat-close");
  var expandBtn = document.getElementById("faq-chat-expand");
  var resizer = document.getElementById("faq-chat-resizer");
  var messages = document.getElementById("faq-chat-messages");
  var quickChips = document.getElementById("faq-quick-chips");
  var form = document.getElementById("faq-chat-form");
  var input = document.getElementById("faq-chat-input");
  var openFromInquiryBtn = document.getElementById("open-chatbot-from-inquiry");

  if (!toggleBtn || !panel) return;

  function addMessage(text, sender) {
    var el = document.createElement("div");
    el.className = "faq-msg faq-msg-" + sender;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function findAnswer(query) {
    var q = query.toLowerCase();
    var best = null;
    var bestScore = 0;
    (window.FAQ_DATA || []).forEach(function (item) {
      var score = 0;
      item.keywords.forEach(function (kw) {
        if (q.indexOf(kw.toLowerCase()) !== -1) score++;
      });
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    });
    return best;
  }

  function renderQuickChips() {
    if (!quickChips) return;
    quickChips.innerHTML = "";
    (window.FAQ_DATA || []).forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "faq-chip";
      btn.textContent = item.label || item.question;
      btn.addEventListener("click", function () {
        addMessage(item.question, "user");
        addMessage(item.answer, "bot");
      });
      quickChips.appendChild(btn);
    });
  }

  renderQuickChips();

  toggleBtn.addEventListener("click", function () {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) input.focus();
  });

  if (openFromInquiryBtn) {
    openFromInquiryBtn.addEventListener("click", function () {
      panel.classList.remove("hidden");
      input.focus();
    });
  }

  closeBtn.addEventListener("click", function () {
    panel.classList.add("hidden");
  });

  // ── 챗봇 창 크기 조절 (확대/축소 버튼 + 좌상단/좌측/상단 드래그 리사이즈) ──
  var isExpanded = false;
  var savedSize = { width: 360, height: 480 };

  if (expandBtn) {
    expandBtn.addEventListener("click", function () {
      if (!isExpanded) {
        savedSize.width = panel.offsetWidth;
        savedSize.height = panel.offsetHeight;
        panel.style.width = Math.min(560, window.innerWidth - 36) + "px";
        panel.style.height = Math.min(680, window.innerHeight - 120) + "px";
        expandBtn.textContent = "⤡";
        isExpanded = true;
      } else {
        panel.style.width = savedSize.width + "px";
        panel.style.height = savedSize.height + "px";
        expandBtn.textContent = "⤢";
        isExpanded = false;
      }
    });
  }

  if (resizer) {
    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startY = e.clientY;
      var startWidth = panel.offsetWidth;
      var startHeight = panel.offsetHeight;

      function onMouseMove(moveEvent) {
        var newWidth = startWidth + (startX - moveEvent.clientX);
        var newHeight = startHeight + (startY - moveEvent.clientY);
        var maxW = window.innerWidth - 36;
        var maxH = window.innerHeight - 110;
        panel.style.width = Math.max(300, Math.min(maxW, newWidth)) + "px";
        panel.style.height = Math.max(360, Math.min(maxH, newHeight)) + "px";
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var query = input.value.trim();
    if (!query) return;

    addMessage(query, "user");
    input.value = "";

    var match = findAnswer(query);
    if (match) {
      addMessage(match.answer, "bot");
    } else {
      addMessage(
        "죄송해요, 이 질문에는 바로 답을 드리기 어려워요. \"사전 문의하기\" 탭의 폼에 남겨주시면 담당자가 확인 후 회신드릴게요.",
        "bot"
      );
    }
  });
});
