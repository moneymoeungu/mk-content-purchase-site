// 매일경제 콘텐츠 구매 - 내부용 FAQ 검색 챗봇 (Apps Script 웹앱)
// 외부용(AppsScript.gs)과 별개의 Apps Script 프로젝트로 만들어 배포합니다. 설치 방법은 채팅 안내를 참고하세요.
//
// 스크립트 속성(프로젝트 설정 > 스크립트 속성)에 저장되는 값:
// - ANTHROPIC_API_KEY  : Claude API 키 (직접 입력)
// - FAQ_SPREADSHEET_ID : 내부 FAQ 시트 ID (setup 실행 시 자동 저장)

var FAQ_SHEET_NAME = "내부FAQ";
var FAQ_HEADER = ["질문", "답변", "비고(내부 메모)"];
var CLAUDE_MODEL = "claude-opus-5-5";
// Claude에 함께 보내는 최근 대화 수. 첫 메시지가 항상 사용자 질문이 되도록 홀수로 둡니다.
var MAX_HISTORY = 9;

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Chat").setTitle("매경 콘텐츠 구매 내부 FAQ");
}

// ── 최초 1회 실행: 내부 FAQ 스프레드시트를 새로 만들고 ID를 스크립트 속성에 저장합니다.
// 에디터 상단에서 setup 선택 후 ▷ 실행하면, 실행 로그에 시트 주소가 표시됩니다.
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("FAQ_SPREADSHEET_ID")) {
    Logger.log("이미 만들어진 FAQ 시트가 있습니다: " + SpreadsheetApp.openById(props.getProperty("FAQ_SPREADSHEET_ID")).getUrl());
    return;
  }

  var ss = SpreadsheetApp.create("매경 콘텐츠 구매 내부 FAQ");
  var sheet = ss.getSheets()[0];
  sheet.setName(FAQ_SHEET_NAME);
  sheet.appendRow(FAQ_HEADER);
  sheet.getRange(1, 1, 1, FAQ_HEADER.length).setFontWeight("bold").setBackground("#FCE4C5");
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, INITIAL_FAQ.length, FAQ_HEADER.length).setValues(INITIAL_FAQ);

  props.setProperty("FAQ_SPREADSHEET_ID", ss.getId());
  Logger.log("내부 FAQ 시트를 만들었습니다: " + ss.getUrl());
}

// 외부 챗봇(js/faq-data.js)과 같은 내용으로 시작합니다. 이후에는 시트에서 직접 추가/수정하세요.
var INITIAL_FAQ = [
  ["기사 구매 후, 자체 영문 번역 시 저작권료 추가 여부", "가능합니다. 자체 번역이나 자동 번역을 했다는 사실을 남기고 사용하시면 되고, 저작권료는 추가되지 않습니다.\n다만 번역 오류에 대해서는 매경이 책임지지 않습니다.", ""],
  ["영화 장면 속 매경 브랜드 로고 사용", "콘텐츠 판매와는 별도 사안이라 매일경제신문사 총무국으로 안내해 드립니다.\nkim.myungwan@mk.co.kr / 02-2000-2550", ""],
  ["오늘의 운세 페이지 사용 여부", "가능합니다. 기존 방송용 기사 저작권료와 동일하게 청구됩니다.", ""],
  ["과거 데이터 학술적 활용 및 웹스크래핑 가능 여부", "지면·기사 이미지를 무단으로 웹스크래핑하거나 OCR로 텍스트를 추출하는 것은 별도 허가 절차가 반드시 필요합니다.\n대학 소속 연구자나 학술 연구 프로젝트를 위한 별도 라이선스·전용 협약 프로그램은 운영하고 있지 않습니다.\n다만 학술 연구 목적으로 정식 계약 후 자료를 구매하실 경우 정가 대비 50% 할인율이 적용됩니다.\n단, 장기간·대량 데이터 접근은 개별 구매 방식으로 진행하기엔 예산·비용 면에서 현실적으로 어렵습니다.", ""],
  ["기사 구매 후, pdf 파일로 이용 시", "가능합니다. PDF 파일로 이용하실 경우 +30만원이 추가됩니다.\n단, 학술 목적이거나 광고 목적인 경우에는 PDF 이용이 불가합니다.", ""],
  ["mbn 기사 사용 문의", "mbn 기사는 별도 문의처로 안내해 드립니다.\n02-2000-3114 / mbn 콘텐츠마케팅부 02-2000-5971", ""],
  ["매경경영지원본부 칼럼 작성자 정보 문의", "죄송하지만 칼럼 작성자 정보는 안내해드리기 어렵습니다.\n매경경영지원본부(02-1800-9440)로 문의해 주세요.", ""]
];

// ── 챗봇 질의: 화면(Chat.html)에서 google.script.run으로 호출합니다.
// history: [{ role: "user" | "assistant", content: "..." }, ...] (마지막이 이번 질문)
function askFaq(history) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("스크립트 속성에 ANTHROPIC_API_KEY가 없습니다.");

  var messages = history.slice(-MAX_HISTORY).map(function (m) {
    return { role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) };
  });

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01"
    },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      fallbacks: "default",
      output_config: { effort: "low" },
      system: buildSystemPrompt_(loadFaq_(props)),
      messages: messages
    }),
    muteHttpExceptions: true
  });

  var body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error("Claude API 오류 (" + response.getResponseCode() + "): " + (body.error ? body.error.message : response.getContentText()));
  }
  if (body.stop_reason === "refusal") {
    return "이 질문에는 답변할 수 없습니다. 질문을 바꿔서 다시 시도해 주세요.";
  }

  return body.content
    .filter(function (block) { return block.type === "text"; })
    .map(function (block) { return block.text; })
    .join("");
}

function loadFaq_(props) {
  var id = props.getProperty("FAQ_SPREADSHEET_ID");
  if (!id) throw new Error("FAQ 시트가 없습니다. 에디터에서 setup 함수를 먼저 실행하세요.");

  var values = SpreadsheetApp.openById(id).getSheetByName(FAQ_SHEET_NAME).getDataRange().getValues();
  return values.slice(1).filter(function (row) {
    return String(row[0]).trim();
  });
}

function buildSystemPrompt_(faqRows) {
  var faqText = faqRows.map(function (row, i) {
    var lines = ["[" + (i + 1) + "] 질문: " + row[0], "답변: " + row[1]];
    if (String(row[2]).trim()) lines.push("비고: " + row[2]);
    return lines.join("\n");
  }).join("\n\n");

  return [
    "당신은 매일경제 콘텐츠 구매 문의를 응대하는 사내 담당자를 돕는 FAQ 검색 도우미입니다.",
    "담당자가 고객 문의에 어떻게 답해야 하는지 물으면, 아래 FAQ에서 해당하는 내용을 찾아 알려 주세요.",
    "",
    "규칙:",
    "- 아래 FAQ에 적힌 내용만 근거로 답합니다. 금액·연락처·조건은 FAQ에 적힌 그대로 옮기고, 추측하거나 지어내지 않습니다.",
    "- FAQ에 없는 내용이면 \"FAQ에 등록되지 않은 내용입니다\"라고 분명히 말하고, 관련이 있어 보이는 항목이 있으면 그것만 덧붙입니다.",
    "- 비고는 사내 전용 메모입니다. 담당자에게는 알려 주되, 고객에게 그대로 전달할 내용이 아니라는 점을 함께 알려 주세요.",
    "- 화면이 일반 텍스트만 표시하므로 마크다운 기호(**, #, - 목록 등) 없이 짧은 문장과 줄바꿈으로 답합니다.",
    "- 답변 마지막 줄에 근거가 된 FAQ 질문 제목을 \"근거: ...\" 형태로 적습니다.",
    "",
    "<faq>",
    faqText,
    "</faq>"
  ].join("\n");
}
