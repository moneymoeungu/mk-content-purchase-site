// 매일경제 콘텐츠 구매 문의 + 신청서 접수 - Google Sheets 적재 / 이메일 알림 / 사용허가서 자동 발급
// 설치 방법은 채팅 안내를 참고하세요.

// 알림을 받을 담당자 메일 목록. 팀원을 추가하려면 쉼표로 구분해서 더 넣으면 됩니다.
var NOTIFY_EMAILS = ["moon.chaerin@mkinternet.com"];
var NOTIFY_EMAIL_LIST = NOTIFY_EMAILS.join(","); // MailApp 수신자용 (쉼표 구분 문자열)
var NOTIFY_EMAIL_PRIMARY = NOTIFY_EMAILS[0]; // 안내문에 "문의처"로 표시할 대표 메일
var DOC_FONT = "맑은 고딕"; // PDF 문서(신청서/허가서) 공통 폰트

// 문의/신청서가 쌓이는 스프레드시트 (URL의 /d/ 와 /edit 사이 값)
var SPREADSHEET_ID = "1tXVt9_9n7bFiyn5nltCeNrcxo5feCTziu8Wte059wCk";

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 전화번호 등 숫자처럼 보이는 값을 글자 그대로 저장 (앞자리 0 유지). 셀에는 ' 없이 표시됩니다.
function asText_(v) {
  return v ? "'" + v : "";
}

// ── 문의(1차 상담) ──────────────────────────────
var SHEET_NAME = "문의내역";
var HEADER = ["접수일시", "기사링크", "사용목적(대분류)", "사용목적(상세)", "특이사항", "특이사항여부", "기타문의", "회사명", "담당자명", "연락처/이메일", "처리상태"];

// ── 신청서(정식 구매 신청) ──────────────────────────────
var SHEET_NAME_APPLICATION = "신청서";
// 기사목록: 기사 여러 건을 [{title,url,date,photoIndex}, ...] 형태의 JSON 문자열로 한 칸에 저장
var APPLICATION_HEADER = ["접수일시", "법인명", "사업자등록번호", "주소", "전화", "담당자명", "e-mail", "기사목록", "사용목적", "특이사항", "세금계산서메일", "청구액", "처리상태", "허가서발송일시"];
var COL_AMOUNT = 12;   // 청구액
var COL_STATUS = 13;   // 처리상태
var COL_SENT_AT = 14;  // 허가서발송일시

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.formType === "application") {
      return handleApplicationSubmit_(data);
    }
    return handleInquirySubmit_(data);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("OK");
}

// ── 문의 처리 ──────────────────────────────
function handleInquirySubmit_(data) {
  var sheet = getOrCreateSheet_();
  var hasSpecialNote = !!(data.specialNote && String(data.specialNote).trim());
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  var row = [
    timestamp,
    data.articleUrl || "",
    data.purposeCategory || "",
    data.purposeDetail || "",
    data.specialNote || "",
    hasSpecialNote ? "TRUE" : "FALSE",
    data.etcInquiry || "",
    data.companyName || "",
    data.managerName || "",
    asText_(data.contact),
    "신규"
  ];
  sheet.appendRow(row);

  if (hasSpecialNote) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, row.length).setBackground("#FFF2CC");
  }

  sendNotificationEmail_(data, hasSpecialNote, timestamp, sheet);

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight("bold").setBackground("#FCE4C5");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sendNotificationEmail_(data, hasSpecialNote, timestamp, sheet) {
  var subject = (hasSpecialNote ? "[특이사항 있음] " : "") + "매일경제 콘텐츠 구매 문의가 접수되었습니다";
  var body = [
    "새 문의가 접수되었습니다. (" + timestamp + ")",
    "",
    "기사 링크: " + (data.articleUrl || "-"),
    "사용 목적: " + (data.purposeCategory || "-") + " / " + (data.purposeDetail || "-"),
    "특이사항: " + (data.specialNote || "-"),
    "기타 문의: " + (data.etcInquiry || "-"),
    "회사명: " + (data.companyName || "-"),
    "담당자명: " + (data.managerName || "-"),
    "연락처/이메일: " + (data.contact || "-"),
    "",
    "스프레드시트에서 전체 내역 확인: " + sheet.getParent().getUrl()
  ].join("\n");

  MailApp.sendEmail(NOTIFY_EMAIL_LIST, subject, body);
}

// ── 신청서 처리 ──────────────────────────────
function handleApplicationSubmit_(data) {
  var sheet = getOrCreateApplicationSheet_();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  var row = [
    timestamp,
    data.companyName || "",
    asText_(data.bizRegNo),
    data.address || "",
    asText_(data.phone),
    data.managerName || "",
    data.email || "",
    JSON.stringify(data.articles || []),
    data.purpose || "",
    data.specialNote || "",
    data.taxInvoiceEmail || "",
    "",      // 청구액 - 담당자가 검토 후 입력
    "접수",  // 처리상태
    ""       // 허가서발송일시
  ];
  sheet.appendRow(row);

  var pdfBlob = buildApplicationPdf_(data);
  notifyApplicationReceived_(data, timestamp, sheet, pdfBlob);

  var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    pdfBase64: pdfBase64,
    pdfFileName: pdfBlob.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateApplicationSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME_APPLICATION);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_APPLICATION);
    sheet.appendRow(APPLICATION_HEADER);
    sheet.getRange(1, 1, 1, APPLICATION_HEADER.length).setFontWeight("bold").setBackground("#FCE4C5");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notifyApplicationReceived_(data, timestamp, sheet, pdfBlob) {
  var subject = "매일경제 콘텐츠 구매 신청서가 접수되었습니다 - " + (data.companyName || "");
  var articleLines = (data.articles || []).map(function (art, i) {
    return (i + 1) + ". " + (art.title || "-") + " (" + (art.url || "-") + ")";
  }).join("\n");
  var body = [
    "새 구매 신청서가 접수되었습니다. (" + timestamp + ")",
    "",
    "법인명: " + (data.companyName || "-"),
    "담당자명: " + (data.managerName || "-"),
    "e-mail: " + (data.email || "-"),
    "기사 목록 (" + (data.articles || []).length + "건):",
    articleLines,
    "사용목적: " + (data.purpose || "-"),
    "",
    "신청서 PDF를 첨부해 드립니다.",
    "청구액을 확인하신 뒤 '신청서' 탭에서 청구액을 입력하고 처리상태를 '승인'으로 변경하시면,",
    "콘텐츠 사용허가서가 신청자에게 자동으로 발송됩니다.",
    "",
    "스프레드시트 바로가기: " + sheet.getParent().getUrl()
  ].join("\n");

  MailApp.sendEmail({
    to: NOTIFY_EMAIL_LIST,
    subject: subject,
    body: body,
    attachments: pdfBlob ? [pdfBlob] : []
  });
}

// ── 승인 시 사용허가서 자동 발급 (설치형 트리거 필요: 아래 안내 참고) ──────────────────────────────
// 청구액/처리상태 둘 중 어느 열을 먼저 입력해도 동작하도록, 두 열 중 하나가 수정될 때마다
// 그 시점의 행 상태(처리상태=승인 & 청구액 입력됨)를 확인해서 발급 여부를 판단합니다.
function onEditInstallable(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();
    if (sheet.getName() !== SHEET_NAME_APPLICATION) return;
    if (range.getRow() === 1) return;

    var editedCol = range.getColumn();
    var editedLastCol = editedCol + range.getNumColumns() - 1;
    var touchesStatus = editedCol <= COL_STATUS && COL_STATUS <= editedLastCol;
    var touchesAmount = editedCol <= COL_AMOUNT && COL_AMOUNT <= editedLastCol;
    if (!touchesStatus && !touchesAmount) return;

    var row = range.getRow();
    var rowValues = sheet.getRange(row, 1, 1, APPLICATION_HEADER.length).getValues()[0];
    var a = mapRowToApplication_(rowValues);
    var status = String(rowValues[COL_STATUS - 1]).trim();

    if (status === "발급완료") return; // 이미 발급된 건은 재발송하지 않음
    if (status !== "승인") return;

    if (a.billingAmount === "" || a.billingAmount === null || typeof a.billingAmount === "undefined") {
      e.source.toast("청구액을 입력하면 자동으로 사용허가서가 발급됩니다.", "발급 보류", 6);
      return;
    }

    var issueDateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy년 MM월 dd일");
    var pdfBlob = buildLicensePdf_(a, issueDateText);
    sendLicenseEmail_(a, pdfBlob);

    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.getRange(row, COL_STATUS).setValue("발급완료");
    sheet.getRange(row, COL_SENT_AT).setValue(now);
  } catch (err) {
    e.source.toast("허가서 발급 중 오류: " + err.message, "오류", 10);
  }
}

// ── 최초 1회 실행: SPREADSHEET_ID 시트에 onEditInstallable 트리거를 연결합니다.
// 기존 onEditInstallable 트리거는 지운 뒤, 에디터 상단에서 installEditTrigger 선택 후 ▷ 실행하세요.
function installEditTrigger() {
  ScriptApp.newTrigger("onEditInstallable").forSpreadsheet(SPREADSHEET_ID).onEdit().create();
}

function mapRowToApplication_(v) {
  return {
    timestamp: v[0],
    companyName: v[1],
    bizRegNo: v[2],
    address: v[3],
    phone: v[4],
    managerName: v[5],
    email: v[6],
    articles: parseArticles_(v[7]),
    purpose: v[8],
    specialNote: v[9],
    taxInvoiceEmail: v[10],
    billingAmount: v[11]
  };
}

function parseArticles_(raw) {
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function formatWon_(amount) {
  var n = Number(amount);
  if (isNaN(n)) return String(amount || "0");
  return n.toLocaleString("ko-KR");
}

// 시트 셀 값은 숫자(Number)나 날짜(Date)로 들어올 수 있어, appendTable에 넘기기 전
// 항상 순수 문자열로 변환합니다. (appendTable은 모든 셀이 String이어야 함)
function str_(v) {
  if (v === null || typeof v === "undefined" || v === "") return "-";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v);
}

function sendLicenseEmail_(a, pdfBlob) {
  var subject = "[매일경제] 콘텐츠 사용허가서 발급 안내 - " + (a.companyName || "");
  var body = [
    (a.managerName || "담당자") + "님, 안녕하세요.",
    "",
    "신청하신 콘텐츠 구매 건에 대한 사용허가서가 발급되어 첨부해 드립니다.",
    "청구액 확인 후 세금계산서 수령일로부터 30일 내로 결제 부탁드립니다.",
    "",
    "기타 문의사항은 " + NOTIFY_EMAIL_PRIMARY + " 으로 연락주시기 바랍니다.",
    "",
    "감사합니다."
  ].join("\n");

  if (a.email) {
    MailApp.sendEmail({
      to: a.email,
      cc: NOTIFY_EMAIL_LIST,
      subject: subject,
      body: body,
      attachments: [pdfBlob]
    });
  } else {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL_LIST,
      subject: "[신청자 e-mail 없음] " + subject,
      body: "신청서에 e-mail이 없어 담당자에게만 발송합니다.\n\n" + body,
      attachments: [pdfBlob]
    });
  }
}

// ── 유지보수용: "신청서" 탭을 통째로 삭제합니다.
// 컬럼 구조(APPLICATION_HEADER)를 바꾼 뒤에는, 이미 만들어져 있던 탭은 헤더가 자동으로 갱신되지
// 않으므로 이 함수를 한 번 실행해서 지우면, 다음 신청서 제출 시 새 구조로 자동 재생성됩니다.
// 에디터 상단 함수 선택 드롭다운에서 resetApplicationSheet 선택 후 ▷ 실행 버튼으로 실행하세요.
function resetApplicationSheet() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME_APPLICATION);
  if (sheet) {
    ss.deleteSheet(sheet);
    Logger.log("'" + SHEET_NAME_APPLICATION + "' 탭을 삭제했습니다. 다음 신청서 제출 시 새 구조로 자동 재생성됩니다.");
  } else {
    Logger.log("'" + SHEET_NAME_APPLICATION + "' 탭이 없어 삭제할 것이 없습니다.");
  }
}

// ── 디버그용: 에디터 상단 실행(▷) 버튼으로 이 함수를 직접 실행하면
// 시트/트리거 없이 buildLicensePdf_만 단독으로 테스트할 수 있고, 실패 시 전체 스택 트레이스가
// 에디터 하단 "실행 로그"에 바로 표시됩니다.
function testBuildLicensePdf() {
  var fakeData = {
    companyName: "테스트법인",
    bizRegNo: "123-45-67890",
    address: "서울시 중구",
    phone: "02-1234-5678",
    managerName: "홍길동",
    email: "test@example.com",
    articles: [
      { title: "테스트 기사 1", url: "https://example.com/1", date: "2026-08-01", photoIndex: "1" },
      { title: "테스트 기사 2", url: "https://example.com/2", date: "2026-08-02", photoIndex: "해당없음" }
    ],
    purpose: "테스트 목적",
    specialNote: "",
    taxInvoiceEmail: "tax@example.com",
    billingAmount: 500000
  };
  var pdfBlob = buildLicensePdf_(fakeData, "2026년 08월 10일");
  Logger.log("성공: " + pdfBlob.getName());
}

function testBuildApplicationPdf() {
  var fakeData = {
    companyName: "테스트법인",
    bizRegNo: "123-45-67890",
    address: "서울시 중구",
    phone: "02-1234-5678",
    managerName: "홍길동",
    email: "test@example.com",
    articles: [
      { title: "테스트 기사 1", url: "https://example.com/1", date: "2026-08-01", photoIndex: "1" },
      { title: "테스트 기사 2", url: "https://example.com/2", date: "2026-08-02", photoIndex: "해당없음" }
    ],
    purpose: "테스트 목적",
    specialNote: "",
    taxInvoiceEmail: "tax@example.com"
  };
  var pdfBlob = buildApplicationPdf_(fakeData);
  Logger.log("성공: " + pdfBlob.getName());
}

// ── 사용허가서 PDF 생성 ──────────────────────────────
function buildLicensePdf_(a, issueDateText) {
  var doc = DocumentApp.create("임시_사용허가서_" + new Date().getTime());
  var body = doc.getBody();
  body.setMarginTop(20).setMarginBottom(20).setMarginLeft(34).setMarginRight(34);

  appendBar_(body, "매일경제 콘텐츠 사용허가서", "#E8801A", "#FFFFFF", true, 15, DocumentApp.HorizontalAlignment.CENTER);

  appendBar_(body, "신청자 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["법인명", str_(a.companyName), "사업자등록번호", str_(a.bizRegNo)],
    ["주소", str_(a.address), "전화", str_(a.phone)],
    ["담당자명", str_(a.managerName), "e-mail", str_(a.email)]
  ], [0, 2]);

  appendBar_(body, "콘텐츠 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendArticlesSection_(body, a.articles);

  appendBar_(body, "사용 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["1. 사용목적", str_(a.purpose)],
    ["2. 특이사항", str_(a.specialNote)]
  ], [0]);

  appendBar_(body, "결제 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["청구액(VAT별도)", formatWon_(a.billingAmount) + "원"],
    ["세금계산서 메일", str_(a.taxInvoiceEmail)]
  ], [0]);
  appendDataTable_(body, [
    ["세금계산서 발행", "신청서 제출 당월 발행", "입금 예정일", "계산서 수령 후 30일 내 입금요망"]
  ], [0, 2]);
  appendDataTable_(body, [
    ["결제계좌", "우리은행 701-007396-13-002 (예금주: (주)매경에이엑스)"]
  ], [0]);

  var confirmPar = body.appendParagraph("위와 같이 콘텐츠 사용을 허가합니다.");
  confirmPar.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(6).setSpacingAfter(0);
  confirmPar.editAsText().setFontFamily(DOC_FONT).setBold(true).setFontSize(9);

  var datePar = body.appendParagraph("허 가 일 : " + issueDateText);
  datePar.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(2).setSpacingAfter(6);
  datePar.editAsText().setFontFamily(DOC_FONT).setFontSize(9);

  var notice1 = body.appendParagraph("1. 본 허가서는 콘텐츠 사용 계약서를 대신합니다.");
  notice1.setSpacingBefore(0).setSpacingAfter(0);
  notice1.editAsText().setFontFamily(DOC_FONT).setFontSize(8).setForegroundColor("#6B6B6B");
  var notice2 = body.appendParagraph("2. 본 허가서는 결제 이후부터 효력이 발생합니다.");
  notice2.setSpacingBefore(0).setSpacingAfter(6);
  notice2.editAsText().setFontFamily(DOC_FONT).setFontSize(8).setForegroundColor("#6B6B6B");

  var companyPar = body.appendParagraph("주식회사 매경에이엑스");
  companyPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(4).setSpacingAfter(0);
  companyPar.editAsText().setFontFamily(DOC_FONT).setBold(true).setFontSize(13);

  var sealNote = body.appendParagraph("(본 허가서는 전자적으로 발급되었으며, 별도 날인 없이 유효합니다.)");
  sealNote.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(2).setSpacingAfter(6);
  sealNote.editAsText().setFontFamily(DOC_FONT).setFontSize(7).setForegroundColor("#999999");

  appendBar_(body, "(주) 매경에이엑스 (www.mk.co.kr)", "#E8801A", "#FFFFFF", true, 9, DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
  pdfBlob.setName("매일경제_콘텐츠사용허가서_" + (a.companyName || "신청자") + ".pdf");

  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfBlob;
}

// ── 구매신청서 PDF 생성 ──────────────────────────────
function buildApplicationPdf_(data) {
  var doc = DocumentApp.create("임시_구매신청서_" + new Date().getTime());
  var body = doc.getBody();
  body.setMarginTop(20).setMarginBottom(20).setMarginLeft(34).setMarginRight(34);

  appendBar_(body, "매일경제 콘텐츠 구매신청서", "#E8801A", "#FFFFFF", true, 15, DocumentApp.HorizontalAlignment.CENTER);

  appendBar_(body, "신청자 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["법인명", str_(data.companyName), "사업자등록번호", str_(data.bizRegNo)],
    ["주소", str_(data.address), "전화", str_(data.phone)],
    ["담당자명", str_(data.managerName), "e-mail", str_(data.email)]
  ], [0, 2]);

  appendBar_(body, "콘텐츠 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendArticlesSection_(body, data.articles);

  appendBar_(body, "사용 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["1. 사용목적", str_(data.purpose)],
    ["2. 특이사항", str_(data.specialNote)]
  ], [0]);

  appendBar_(body, "결제 정보", "#E8801A", "#FFFFFF", true, 9.5, DocumentApp.HorizontalAlignment.LEFT);
  appendDataTable_(body, [
    ["청구액(VAT별도)", "사용 정보 확인 후, 회신드리겠습니다."],
    ["세금계산서 메일", str_(data.taxInvoiceEmail)]
  ], [0]);
  appendDataTable_(body, [
    ["세금계산서 발행", "신청서 제출 당월 발행", "입금 예정일", "계산서 수령 후 30일 내 입금요망"]
  ], [0, 2]);
  appendDataTable_(body, [
    ["결제계좌", "우리은행 701-007396-13-002 (예금주: (주)매경에이엑스)"]
  ], [0]);

  var confirmPar = body.appendParagraph("위와 같이 콘텐츠 사용을 신청합니다.");
  confirmPar.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(6).setSpacingAfter(0);
  confirmPar.editAsText().setFontFamily(DOC_FONT).setBold(true).setFontSize(9);

  var dateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy년 MM월 dd일");
  var datePar = body.appendParagraph("신 청 일 : " + dateText);
  datePar.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(2).setSpacingAfter(0);
  datePar.editAsText().setFontFamily(DOC_FONT).setFontSize(9);

  var namePar = body.appendParagraph("신 청 인 : " + str_(data.managerName || data.companyName));
  namePar.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(2).setSpacingAfter(6);
  namePar.editAsText().setFontFamily(DOC_FONT).setFontSize(9);

  var notice1 = body.appendParagraph("1. 본 신청서 제출 후, 담당자가 청구액을 확인하여 콘텐츠 사용허가서를 발급해드립니다.");
  notice1.setSpacingBefore(0).setSpacingAfter(0);
  notice1.editAsText().setFontFamily(DOC_FONT).setFontSize(8).setForegroundColor("#6B6B6B");
  var notice2 = body.appendParagraph("2. 기타 문의사항은 " + NOTIFY_EMAIL_PRIMARY + " 으로 연락주시기 바랍니다.");
  notice2.setSpacingBefore(0).setSpacingAfter(6);
  notice2.editAsText().setFontFamily(DOC_FONT).setFontSize(8).setForegroundColor("#6B6B6B");

  appendBar_(body, "(주) 매경에이엑스 (www.mk.co.kr)", "#E8801A", "#FFFFFF", true, 9, DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
  pdfBlob.setName("매일경제_콘텐츠구매신청서_" + (data.companyName || "신청자") + ".pdf");

  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfBlob;
}

// 콘텐츠 정보(구매 기사 목록) 렌더링 — 허가서/신청서 PDF 공통
function appendArticlesSection_(body, articles) {
  var list = (articles && articles.length) ? articles : [{}];
  list.forEach(function (art, idx) {
    if (list.length > 1) {
      var label = body.appendParagraph((idx + 1) + "번째 기사");
      label.setSpacingBefore(idx === 0 ? 4 : 8).setSpacingAfter(2);
      label.editAsText().setFontFamily(DOC_FONT).setBold(true).setFontSize(8.5).setForegroundColor("#C96C0F");
    }
    appendDataTable_(body, [
      ["1. 기사제목", str_(art.title)],
      ["2. 기사URL", str_(art.url)],
      ["3. 기사날짜", str_(art.date)],
      ["사진 순번", str_(art.photoIndex)]
    ], [0]);
  });
}

function appendBar_(body, text, bg, fg, bold, size, align) {
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.appendTableRow();
  var cell = row.appendTableCell(text);
  cell.setBackgroundColor(bg);
  cell.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(8).setPaddingRight(8);
  var par = cell.getChild(0).asParagraph();
  par.setAlignment(align).setSpacingBefore(0).setSpacingAfter(0);
  var t = par.editAsText();
  t.setFontFamily(DOC_FONT).setForegroundColor(fg).setBold(bold).setFontSize(size);
}

function appendDataTable_(body, rows, labelCols) {
  var table = body.appendTable();
  table.setBorderColor("#D9D9D9");
  for (var r = 0; r < rows.length; r++) {
    var tableRow = table.appendTableRow();
    for (var c = 0; c < rows[r].length; c++) {
      var cell = tableRow.appendTableCell(rows[r][c]);
      cell.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(6).setPaddingRight(6);
      var cellPar = cell.getChild(0).asParagraph();
      cellPar.setSpacingBefore(0).setSpacingAfter(0);
      if (labelCols.indexOf(c) !== -1) {
        cell.setBackgroundColor("#FBEADA");
        cellPar.editAsText().setFontFamily(DOC_FONT).setBold(true).setFontSize(8.5);
      } else {
        cell.setBackgroundColor("#FFFFFF");
        cellPar.editAsText().setFontFamily(DOC_FONT).setBold(false).setFontSize(8.5);
      }
    }
  }
  return table;
}
