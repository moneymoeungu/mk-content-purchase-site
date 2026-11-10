// 매일경제 콘텐츠 구매 문의 + 신청서 접수 - Google Sheets 적재 / 이메일 알림 / 사용허가서 및 매출전표(xlsx) 자동 발급
// 설치 방법은 채팅 안내를 참고하세요.

// 알림을 받을 담당자 메일 목록. 팀원을 추가하려면 쉼표로 구분해서 더 넣으면 됩니다.
var NOTIFY_EMAILS = [
  "moon.chaerin@mkinternet.com",
  "pyun.heeje@mkinternet.com",
  "kim.heeyeon@mkinternet.com",
  "kim.jiwoo@mkinternet.com"
];
var NOTIFY_EMAIL_LIST = NOTIFY_EMAILS.join(","); // MailApp 수신자용 (쉼표 구분 문자열)
var NOTIFY_EMAIL_PRIMARY = NOTIFY_EMAILS[0]; // 안내문에 "문의처"로 표시할 대표 메일
var DOC_FONT = "맑은 고딕"; // PDF/시트 문서 공통 폰트
var DEFAULT_VOUCHER_WRITER = "문채린"; // 매출전표 기본 작성자 (엑셀에서 수정 가능)

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

// ── 매출전표 시트 탭 이름 ──────────────────────────────
var SHEET_NAME_VOUCHER = "매출전표";

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
  var subject = (hasSpecialNote ? "[특이사항 있음] " : "") + "[매일경제] 콘텐츠 구매 사전 문의가 접수되었습니다 - " + (data.companyName || "미기재");
  var body = [
    "새로운 콘텐츠 구매 사전 문의가 접수되었습니다. (" + timestamp + ")",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "• 회사명(소속): " + (data.companyName || "-"),
    "• 담당자명: " + (data.managerName || "-"),
    "• 회신 연락처/이메일: " + (data.contact || "-"),
    "",
    "• 문의 기사 링크: " + (data.articleUrl || "-"),
    "• 사용 목적: " + (data.purposeCategory || "-") + " / " + (data.purposeDetail || "-"),
    "• 특이사항: " + (data.specialNote || "없음"),
    "• 기타 문의: " + (data.etcInquiry || "없음"),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "▶ 구글 스프레드시트('문의내역' 탭)에서 확인하기:",
    sheet.getParent().getUrl()
  ].join("\n");

  MailApp.sendEmail(NOTIFY_EMAIL_LIST, subject, body);
}

// ── 신청서 처리 ──────────────────────────────
function handleApplicationSubmit_(data) {
  var sheet = getOrCreateApplicationSheet_();
  var hasSpecialNote = !!(data.specialNote && String(data.specialNote).trim());
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

  if (hasSpecialNote) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, row.length).setBackground("#FFF2CC");
  }

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
  var hasSpecialNote = !!(data.specialNote && String(data.specialNote).trim());
  var subject = (hasSpecialNote ? "[특이사항 있음] " : "") + "[매일경제] 콘텐츠 구매 신청서가 접수되었습니다 - " + (data.companyName || "");
  var articleLines = (data.articles || []).map(function (art, i) {
    return "  " + (i + 1) + ". " + (art.title || "-") + " | 날짜: " + (art.date || "-") + " | 사진: " + (art.photoIndex || "해당없음") + "\n     URL: " + (art.url || "-");
  }).join("\n");
  var body = [
    "새로운 콘텐츠 구매 신청서가 접수되었습니다. (" + timestamp + ")",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "[신청자 정보]",
    "• 법인명: " + (data.companyName || "-"),
    "• 사업자등록번호: " + (data.bizRegNo || "-"),
    "• 주소: " + (data.address || "-"),
    "• 담당자명 / 전화: " + (data.managerName || "-") + " / " + (data.phone || "-"),
    "• 허가서 수신 e-mail: " + (data.email || "-"),
    "• 세금계산서 수신 메일: " + (data.taxInvoiceEmail || "-"),
    "",
    "[콘텐츠 및 사용 정보]",
    "• 사용목적: " + (data.purpose || "-"),
    "• 특이사항: " + (data.specialNote || "없음"),
    "• 구매 기사 목록 (총 " + (data.articles || []).length + "건):",
    articleLines,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "[후속 처리 안내]",
    "1. 아래 스프레드시트의 '신청서' 탭으로 이동합니다.",
    "2. 해당 행의 '청구액'(공급가액 숫자)을 입력하고 '처리상태'를 '승인'으로 변경합니다.",
    "3. 변경 즉시 신청자에게는 [콘텐츠 사용허가서 PDF]가 자동 발송되며,",
    "   담당자분들께는 관리팀 제출용 [매출전표 엑셀(.xlsx)] 파일이 이메일로 자동 발송됩니다.",
    "",
    "▶ 구글 스프레드시트 바로가기:",
    sheet.getParent().getUrl()
  ].join("\n");

  MailApp.sendEmail({
    to: NOTIFY_EMAIL_LIST,
    subject: subject,
    body: body,
    attachments: pdfBlob ? [pdfBlob] : []
  });
}

// ── 승인 시 사용허가서(PDF) + 매출전표(XLSX) 자동 발급 ──────────────────────────────
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
      e.source.toast("청구액을 입력하면 자동으로 사용허가서와 매출전표가 발급됩니다.", "발급 보류", 6);
      return;
    }

    var nowObj = new Date();
    var issueDateText = Utilities.formatDate(nowObj, Session.getScriptTimeZone(), "yyyy년 MM월 dd일");
    var saleDateIso = Utilities.formatDate(nowObj, Session.getScriptTimeZone(), "yyyy-MM-dd");

    // 1) 사용허가서 PDF 생성 및 고객 발송
    var pdfBlob = buildLicensePdf_(a, issueDateText);
    sendLicenseEmail_(a, pdfBlob);

    // 2) 구글 시트 내 '매출전표' 탭 자동 업데이트 및 관리팀 제출용 엑셀(.xlsx) 생성 후 담당자 발송
    updateVoucherSheetInMainSpreadsheet_(a, saleDateIso);
    var voucherXlsxBlob = buildSalesVoucherXlsx_(a, saleDateIso);
    sendSalesVoucherEmailToTeam_(a, voucherXlsxBlob, pdfBlob, saleDateIso);

    var now = Utilities.formatDate(nowObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.getRange(row, COL_STATUS).setValue("발급완료");
    sheet.getRange(row, COL_SENT_AT).setValue(now);
    e.source.toast("사용허가서(고객 발송) 및 매출전표 엑셀(담당자 발송) 처리가 완료되었습니다.", "발급 완료", 6);
  } catch (err) {
    e.source.toast("허가서/매출전표 발급 중 오류: " + err.message, "오류", 10);
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

function parseNumber_(val) {
  if (typeof val === "number") return val;
  var cleaned = String(val || "0").replace(/[^\d.-]/g, "");
  var n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatWon_(amount) {
  var n = parseNumber_(amount);
  return n.toLocaleString("ko-KR");
}

function str_(v) {
  if (v === null || typeof v === "undefined" || v === "") return "-";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v);
}

// ── 고객에게 사용허가서 발송 (참조: 담당자 4인) ──────────────────────────────
function sendLicenseEmail_(a, pdfBlob) {
  var supply = parseNumber_(a.billingAmount);
  var vat = Math.round(supply * 0.1);
  var total = supply + vat;
  var subject = "[매일경제] 콘텐츠 사용허가서 발급 및 결제 안내 - " + (a.companyName || "");
  var body = [
    (a.companyName ? a.companyName + " " : "") + (a.managerName || "담당자") + "님, 안녕하세요.",
    "(주)매경에이엑스 콘텐츠사업팀입니다.",
    "",
    "신청하신 매일경제 뉴스콘텐츠 구매 건에 대한 [콘텐츠 사용허가서]가 발급되어 첨부파일(PDF)로 보내드립니다.",
    "",
    "■ 결제 및 세금계산서 안내",
    "• 신청 건수: 총 " + ((a.articles || []).length || 1) + "건 (" + (a.purpose || "-") + ")",
    "• 청구 금액: 공급가액 " + formatWon_(supply) + "원 + 부가세 " + formatWon_(vat) + "원 = 총 " + formatWon_(total) + "원",
    "• 세금계산서 수신 메일: " + (a.taxInvoiceEmail || a.email || "-"),
    "• 입금 계좌: 우리은행 701-007396-13-002 (예금주: (주)매경에이엑스)",
    "• 결제 기한: 세금계산서 수령일로부터 30일 이내 입금 부탁드립니다.",
    "",
    "※ 본 사용허가서는 계약서를 갈음하며, 결제 완료 후 효력이 발생합니다.",
    "※ 기타 문의사항은 " + NOTIFY_EMAIL_PRIMARY + " 으로 연락주시기 바랍니다.",
    "",
    "감사합니다.",
    "(주)매경에이엑스 드림"
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

// ── 담당자 팀에게 관리팀 제출용 매출전표(.xlsx) 발송 ──────────────────────────────
function sendSalesVoucherEmailToTeam_(a, voucherXlsxBlob, licensePdfBlob, saleDateIso) {
  var supply = parseNumber_(a.billingAmount);
  var vat = Math.round(supply * 0.1);
  var subject = "[매출전표 자동생성] " + (a.companyName || "거래처") + " - 뉴스콘텐츠(기사) 사용료 (" + formatWon_(supply) + "원)";
  var body = [
    "신청서 승인 처리에 따라 관리팀 제출용 [매출전표] 엑셀 파일(.xlsx)이 자동 생성되었습니다.",
    "첨부된 엑셀 파일을 열어 내용을 확인하신 후 관리팀에 전달해 주세요.",
    "(작성자 기본값은 '" + DEFAULT_VOUCHER_WRITER + "'으로 기입되어 있으며, 엑셀에서 자유롭게 수정 가능합니다.)",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "• 매출일: " + saleDateIso,
    "• 거래처명: " + (a.companyName || "-"),
    "• 사업자등록번호: " + (a.bizRegNo || "-"),
    "• 품목: 뉴스콘텐츠(기사) 사용료",
    "• 공급가: " + formatWon_(supply) + "원 / 부가세(10%): " + formatWon_(vat) + "원",
    "• 작성자: " + DEFAULT_VOUCHER_WRITER,
    "• 거래처 담당자: " + (a.managerName || "-") + " (" + (a.taxInvoiceEmail || a.email || "-") + " / " + (a.phone || "-") + ")",
    "• 결제확인 / 발행여부 / 청구·영수: 외상매출 / 세금계산서 발행 / 청구",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "※ 구글 스프레드시트 내 '매출전표' 탭에도 동일한 최신 전표가 업데이트되어 있습니다."
  ].join("\n");

  var attachments = [];
  if (voucherXlsxBlob) attachments.push(voucherXlsxBlob);
  if (licensePdfBlob) attachments.push(licensePdfBlob);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL_LIST,
    subject: subject,
    body: body,
    attachments: attachments
  });
}

// ── 매출전표 시트 양식 그리기 (구글 시트 '매출전표' 탭 & 엑셀 파일 공용) ──────────────
// 업로드해주신 매출전표 이미지와 동일한 7열(A~G) 구조로 셀 병합, 테두리, 배경색, 결재란을 구성합니다.
function populateSalesVoucherSheet_(sheet, a, saleDateIso) {
  sheet.clear();
  sheet.setHiddenGridlines(false);

  // 열 너비 설정 (총 7개 열: A~G, 합계 약 700px)
  var colWidths = [110, 120, 140, 95, 78, 78, 78];
  for (var c = 1; c <= 7; c++) {
    sheet.setColumnWidth(c, colWidths[c - 1]);
  }

  // 행 높이 설정
  sheet.setRowHeight(1, 14);
  sheet.setRowHeight(2, 26); // 결재란 헤더 (담당/선임/팀장)
  sheet.setRowHeight(3, 52); // 결재 사인란
  sheet.setRowHeight(4, 14);
  sheet.setRowHeight(5, 28); // 매출일 / 거래처명 / 사업자등록번호 / 비고
  sheet.setRowHeight(6, 34);
  sheet.setRowHeight(7, 12);
  sheet.setRowHeight(8, 28); // 품목 / 공급가 / 부가세
  sheet.setRowHeight(9, 34);
  sheet.setRowHeight(10, 12);
  sheet.setRowHeight(11, 28); // 작성자 / 거래처 담당자 / 담당자 이메일 / 담당자 연락처
  sheet.setRowHeight(12, 34);
  sheet.setRowHeight(13, 12);
  sheet.setRowHeight(14, 28); // 결제확인 / 세금계산서 발행여부 / 청구·영수
  sheet.setRowHeight(15, 34);
  sheet.setRowHeight(16, 18);
  sheet.setRowHeight(17, 36); // (주)매경에이엑스

  // 전체 기본 폰트
  var fullRange = sheet.getRange("A1:G17");
  fullRange.setFontFamily(DOC_FONT).setFontSize(10).setVerticalAlignment("middle").setHorizontalAlignment("center");

  // 1. 제목: 매 출 전 표 (A2:C3 병합, 하단 이중선 스타일 테두리)
  var titleRange = sheet.getRange("A2:C3");
  titleRange.merge();
  titleRange.setValue("매 출 전 표").setFontSize(20).setFontWeight("bold");
  titleRange.setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.DOUBLE);

  // 2. 결재란 (E2:G3)
  sheet.getRange("E2").setValue("담  당");
  sheet.getRange("F2").setValue("선  임");
  sheet.getRange("G2").setValue("팀  장");
  sheet.getRange("E2:G2").setFontWeight("bold").setBackground("#F2F2F2");
  sheet.getRange("E2:G3").setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  // 3. 첫 번째 표: 매출일 | 거래처명(B:C) | 사업자등록번호(D:E) | 비고(F:G)
  sheet.getRange("A5").setValue("매출일");
  sheet.getRange("B5:C5").merge().setValue("거래처명");
  sheet.getRange("D5:E5").merge().setValue("사업자등록번호");
  sheet.getRange("F5:G5").merge().setValue("비고");

  sheet.getRange("A6").setValue(saleDateIso || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));
  sheet.getRange("B6:C6").merge().setValue(a.companyName || "");
  sheet.getRange("D6:E6").merge().setValue(asText_(a.bizRegNo || ""));
  sheet.getRange("F6:G6").merge().setValue(a.specialNote || "");

  styleVoucherTableBlock_(sheet.getRange("A5:G5"), sheet.getRange("A6:G6"));

  // 4. 두 번째 표: 품목(A:C) | 공급가(D:E) | 부가세(F:G)
  var supply = parseNumber_(a.billingAmount);
  var vat = Math.round(supply * 0.1);

  sheet.getRange("A8:C8").merge().setValue("품목");
  sheet.getRange("D8:E8").merge().setValue("공급가");
  sheet.getRange("F8:G8").merge().setValue("부가세");

  sheet.getRange("A9:C9").merge().setValue("뉴스콘텐츠(기사) 사용료");
  sheet.getRange("D9:E9").merge().setValue(supply).setNumberFormat("#,##0");
  // 엑셀에서 공급가를 수정하면 부가세도 10%로 자동 재계산되도록 수식 입력
  sheet.getRange("F9:G9").merge().setFormula("=ROUND(D9*0.1, 0)").setNumberFormat("#,##0");

  styleVoucherTableBlock_(sheet.getRange("A8:G8"), sheet.getRange("A9:G9"));

  // 5. 세 번째 표: 작성자(A) | 거래처 담당자(B) | 담당자 이메일(C:D) | 담당자 연락처(E:G)
  sheet.getRange("A11").setValue("작성자");
  sheet.getRange("B11").setValue("거래처 담당자");
  sheet.getRange("C11:D11").merge().setValue("담당자 이메일");
  sheet.getRange("E11:G11").merge().setValue("담당자 연락처");

  sheet.getRange("A12").setValue(DEFAULT_VOUCHER_WRITER);
  sheet.getRange("B12").setValue(a.managerName || "");
  sheet.getRange("C12:D12").merge().setValue(a.taxInvoiceEmail || a.email || "");
  sheet.getRange("E12:G12").merge().setValue(asText_(a.phone || ""));

  styleVoucherTableBlock_(sheet.getRange("A11:G11"), sheet.getRange("A12:G12"));

  // 6. 네 번째 표: 결제확인(A:B) | 세금계산서/계산서 발행여부(C:E) | 청구/영수(F:G)
  sheet.getRange("A14:B14").merge().setValue("결제확인");
  sheet.getRange("C14:E14").merge().setValue("세금계산서/계산서 발행여부");
  sheet.getRange("F14:G14").merge().setValue("청구/영수");

  sheet.getRange("A15:B15").merge().setValue("외상매출");
  sheet.getRange("C15:E15").merge().setValue("세금계산서 발행");
  sheet.getRange("F15:G15").merge().setValue("청구");

  styleVoucherTableBlock_(sheet.getRange("A14:G14"), sheet.getRange("A15:G15"));

  // 7. 하단 회사명: (주)매경에이엑스
  var footerRange = sheet.getRange("A17:G17");
  footerRange.merge().setValue("(주)매경에이엑스").setFontSize(18).setFontWeight("bold");
}

function styleVoucherTableBlock_(headerRange, valueRange) {
  headerRange.setBackground("#EFEFEF").setFontWeight("bold");
  valueRange.setBackground("#FFFFFF").setWrap(true);
  var block = headerRange.getSheet().getRange(
    headerRange.getRow(),
    1,
    2,
    7
  );
  block.setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
}

// 메인 스프레드시트의 '매출전표' 탭에도 최신 승인 건을 그려줍니다.
function updateVoucherSheetInMainSpreadsheet_(a, saleDateIso) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME_VOUCHER);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_VOUCHER);
  }
  populateSalesVoucherSheet_(sheet, a, saleDateIso);
  SpreadsheetApp.flush();
}

// 관리팀 제출용 단독 엑셀(.xlsx) 파일 Blob 생성
function buildSalesVoucherXlsx_(a, saleDateIso) {
  var tempSS = SpreadsheetApp.create("임시_매출전표_" + new Date().getTime());
  var tempSheet = tempSS.getSheets()[0];
  tempSheet.setName("매출전표");
  populateSalesVoucherSheet_(tempSheet, a, saleDateIso);
  SpreadsheetApp.flush();

  var fileId = tempSS.getId();
  var url = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx";
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  var xlsxBlob = response.getBlob();
  var safeCompany = String(a.companyName || "거래처").replace(/[\\/:*?"<>|]/g, "_");
  xlsxBlob.setName("매출전표_" + safeCompany + "_" + saleDateIso + ".xlsx");

  DriveApp.getFileById(fileId).setTrashed(true);
  return xlsxBlob;
}

// ── 유지보수용: "신청서" 탭을 통째로 삭제합니다.
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

// ── 디버그 및 테스트용: 에디터 상단에서 testSalesVoucherAndEmails 선택 후 ▷ 실행하면
// 시트 수정 없이도 즉시 매출전표 탭 생성 + 엑셀(.xlsx) 메일 발송을 테스트할 수 있습니다.
function testSalesVoucherAndEmails() {
  var fakeData = {
    companyName: "(주)테스트기업",
    bizRegNo: "123-45-67890",
    address: "서울시 중구 퇴계로 190",
    phone: "02-2000-2114",
    managerName: "홍길동",
    email: NOTIFY_EMAIL_PRIMARY,
    articles: [
      { title: "[테스트] 매일경제 AI 혁신 기사", url: "https://www.mk.co.kr/news/it/10000001", date: "2026-11-10", photoIndex: "해당없음(텍스트만)" }
    ],
    purpose: "온라인 게재 - 홈페이지",
    specialNote: "테스트 발송 건입니다.",
    taxInvoiceEmail: NOTIFY_EMAIL_PRIMARY,
    billingAmount: 300000
  };
  var saleDateIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var issueDateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy년 MM월 dd일");

  updateVoucherSheetInMainSpreadsheet_(fakeData, saleDateIso);
  var xlsxBlob = buildSalesVoucherXlsx_(fakeData, saleDateIso);
  var licensePdfBlob = buildLicensePdf_(fakeData, issueDateText);
  sendSalesVoucherEmailToTeam_(fakeData, xlsxBlob, licensePdfBlob, saleDateIso);
  Logger.log("테스트 완료: 매출전표 시트 생성 및 팀 이메일 발송 성공 (" + xlsxBlob.getName() + ")");
}

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
