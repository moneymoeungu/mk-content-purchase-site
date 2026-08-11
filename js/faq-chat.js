document.addEventListener("DOMContentLoaded", function () {
  var toggleBtn = document.getElementById("faq-chat-toggle");
  var panel = document.getElementById("faq-chat-panel");
  var closeBtn = document.getElementById("faq-chat-close");
  var messages = document.getElementById("faq-chat-messages");
  var form = document.getElementById("faq-chat-form");
  var input = document.getElementById("faq-chat-input");

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

  toggleBtn.addEventListener("click", function () {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) input.focus();
  });

  closeBtn.addEventListener("click", function () {
    panel.classList.add("hidden");
  });

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
        "죄송해요, 이 질문에는 바로 답을 드리기 어려워요. 아래 \"문의하기\" 폼에 남겨주시면 담당자가 확인 후 회신드릴게요.",
        "bot"
      );
    }
  });
});
