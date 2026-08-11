# 매일경제 콘텐츠 구매신청서 엑셀 템플릿 생성 (Excel COM 자동화)
$ErrorActionPreference = "Stop"

$outPath = "c:\Users\user\OneDrive\Desktop\VIBE\assets\매경_콘텐츠구매신청서.xlsx"
if (Test-Path $outPath) { Remove-Item $outPath -Force }

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Add()
$ws = $wb.Worksheets.Item(1)
$ws.Name = "구매신청서"

# 색상 정의 (BGR 정수, VBA 컬러 값)
function RGBColor($r, $g, $b) { return $r + ($g * 256) + ($b * 65536) }
$orange      = RGBColor 232 126 34    # 진한 오렌지 (헤더)
$lightOrange = RGBColor 252 224 189   # 연한 오렌지 (섹션 배경)
$white       = RGBColor 255 255 255
$grayText    = RGBColor 120 120 120
$lightBorder = RGBColor 217 217 217

# 열 너비
$ws.Columns.Item(1).ColumnWidth = 18
$ws.Columns.Item(2).ColumnWidth = 26
$ws.Columns.Item(3).ColumnWidth = 18
$ws.Columns.Item(4).ColumnWidth = 26

function Merge-Style($rng, [int]$bg, [int]$fontColor, [bool]$bold, [int]$size, [int]$align, [bool]$wrap) {
    $rng.Merge() | Out-Null
    $rng.Interior.Color = $bg
    $rng.Font.Color = $fontColor
    $rng.Font.Bold = $bold
    $rng.Font.Size = $size
    $rng.HorizontalAlignment = $align
    $rng.VerticalAlignment = -4108  # xlCenter
    $rng.WrapText = $wrap
}

function Set-Border($rng) {
    foreach ($idx in 7,8,9,10,11,12) {
        $b = $rng.Borders.Item($idx)
        $b.LineStyle = 1
        $b.Weight = 2
        $b.Color = $lightBorder
    }
}

function Label-Cell($rng, $text) {
    $rng.Value2 = $text
    $rng.Interior.Color = $lightOrange
    $rng.Font.Bold = $true
    $rng.Font.Size = 10
    $rng.HorizontalAlignment = -4108
    $rng.VerticalAlignment = -4108
}

function Value-Cell($rng, $hint) {
    if ($hint) {
        $rng.Value2 = $hint
        $rng.Font.Color = $grayText
        $rng.Font.Italic = $true
    }
    $rng.Interior.Color = $white
    $rng.Font.Size = 10
    $rng.HorizontalAlignment = -4131
    $rng.VerticalAlignment = -4108
    $rng.IndentLevel = 1
}

function Note-Row([int]$row, $text, [int]$size = 9, [bool]$bold = $false) {
    $r = $ws.Range(("A{0}:D{0}" -f $row))
    $r.Merge() | Out-Null
    $r.Value2 = $text
    $r.Font.Size = $size
    $r.Font.Bold = $bold
    $r.Font.Color = $grayText
    $r.HorizontalAlignment = -4131
    $r.VerticalAlignment = -4108
    $r.WrapText = $true
}

function Section-Header($row, $text) {
    $r = $ws.Range(("A{0}:D{0}" -f $row))
    Merge-Style $r $orange $white $true 11 -4131 $false
    $r.Value2 = "  $text"
    $ws.Rows.Item($row).RowHeight = 22
}

# ── 제목 ──────────────────────────────
$title = $ws.Range("A1:D1")
Merge-Style $title $orange $white $true 18 -4108 $false
$title.Value2 = "매일경제 콘텐츠 구매신청서"
$ws.Rows.Item(1).RowHeight = 36

# ── 신청자 정보 ──────────────────────────────
Section-Header 3 "신청자 정보"

Label-Cell $ws.Range("A4") "법인명"
Value-Cell  $ws.Range("B4") $null
Label-Cell $ws.Range("C4") "사업자등록번호"
Value-Cell  $ws.Range("D4") $null

Label-Cell $ws.Range("A5") "주소"
Value-Cell  $ws.Range("B5") $null
Label-Cell $ws.Range("C5") "전화"
Value-Cell  $ws.Range("D5") $null

Label-Cell $ws.Range("A6") "담당자명"
Value-Cell  $ws.Range("B6") $null
Label-Cell $ws.Range("C6") "e-mail"
Value-Cell  $ws.Range("D6") $null

# ── 콘텐츠 정보 ──────────────────────────────
Section-Header 8 "콘텐츠 정보"
Note-Row 9  "아래 구매할 콘텐츠의 세부사항을 정확히 작성해 주세요."
Note-Row 10 "- 출처 명기해주시기 바랍니다. (예시) <출처: 매일경제> <출처: 스타투데이>"
Note-Row 11 "- 외부 필진 기고문은 매일경제에 저작권이 없으므로 판매 불가합니다."
Note-Row 12 "- 옛날 신문기사의 경우 지면 페이지를 같이 기재해주세요."

Label-Cell $ws.Range("A13") "1. 기사제목"
$v13 = $ws.Range("B13:D13"); $v13.Merge() | Out-Null; Value-Cell $v13 $null

Label-Cell $ws.Range("A14") "2. 기사URL"
$v14 = $ws.Range("B14:D14"); $v14.Merge() | Out-Null; Value-Cell $v14 $null

Label-Cell $ws.Range("A15") "3. 기사날짜"
$v15 = $ws.Range("B15:D15"); $v15.Merge() | Out-Null; Value-Cell $v15 $null

Label-Cell $ws.Range("A16") "사진 순번"
$v16 = $ws.Range("B16:D16"); $v16.Merge() | Out-Null
Value-Cell $v16 "구매하시는 콘텐츠가 '사진'인 경우, 기사 내 몇 번째 사진인지 기재해 주세요. (원본사진 제공X)"
$ws.Rows.Item(16).RowHeight = 28

# ── 사용 정보 ──────────────────────────────
Section-Header 18 "사용 정보"
Note-Row 19 "아래 사용 목적을 정확히 작성해 주세요."

Label-Cell $ws.Range("A20") "1. 사용목적"
$v20 = $ws.Range("B20:D20"); $v20.Merge() | Out-Null; Value-Cell $v20 $null

Label-Cell $ws.Range("A21") "2. 특이사항"
$v21 = $ws.Range("B21:D21"); $v21.Merge() | Out-Null
Value-Cell $v21 "기타 특이사항이 있는 경우 기재해 주세요."
$ws.Rows.Item(21).RowHeight = 26

Note-Row 22 "기타 문의사항은 moon.chaerin@mkinternet.com 으로 연락주시기 바랍니다."

# ── 결제 정보 ──────────────────────────────
Section-Header 24 "결제 정보"

Label-Cell $ws.Range("A25") "청구액(VAT별도)"
$v25 = $ws.Range("B25:D25"); $v25.Merge() | Out-Null
Value-Cell $v25 "사용 정보 확인 후, 회신드리겠습니다."

Label-Cell $ws.Range("A26") "세금계산서 메일"
$v26 = $ws.Range("B26:D26"); $v26.Merge() | Out-Null
Value-Cell $v26 "세금계산서 수신할 메일을 기재해 주세요."

Label-Cell $ws.Range("A27") "세금계산서 발행"
$v27 = $ws.Range("B27"); Value-Cell $v27 "신청서 제출 당월 발행"
Label-Cell $ws.Range("C27") "입금 예정일"
Value-Cell  $ws.Range("D27") "계산서 수령 후 30일 내 입금요망"

Label-Cell $ws.Range("A28") "결제계좌"
$v28 = $ws.Range("B28:D28"); $v28.Merge() | Out-Null
$v28.Value2 = "우리은행 701-007396-13-002 (예금주: (주)매경에이엑스)"
$v28.Interior.Color = $white
$v28.Font.Size = 10
$v28.HorizontalAlignment = -4131
$v28.VerticalAlignment = -4108
$v28.IndentLevel = 1

# ── 신청 확인 ──────────────────────────────
Note-Row 30 "위와 같이 콘텐츠 사용을 신청합니다." 10 $true
$ws.Range("A30:D30").HorizontalAlignment = -4152
Note-Row 31 "신청일 :        년      월      일" 10 $false
$ws.Range("A31:D31").HorizontalAlignment = -4152
Note-Row 32 "신청인 :                                   (인)" 10 $false
$ws.Range("A32:D32").HorizontalAlignment = -4152

# ── 안내사항 ──────────────────────────────
Note-Row 34 "1. 본 신청서 작성 후 메일주시면, 콘텐츠사용허가서를 발급해드립니다." 9 $false
Note-Row 35 "2. 본 신청서와 사업자등록증 함께 회신 부탁드립니다." 9 $false
Note-Row 36 "3. 해당 파일 다운 후, 작성하신 신청서는 '엑셀' 파일로 이메일(moon.chaerin@mkinternet.com)을 보내주세요." 9 $false

# ── 푸터 ──────────────────────────────
$footer = $ws.Range("A38:D38")
Merge-Style $footer $orange $white $true 11 -4108 $false
$footer.Value2 = "(주) 매경에이엑스 (www.mk.co.kr)"
$ws.Rows.Item(38).RowHeight = 24

# 전체 테두리 (A1:D38)
$allRange = $ws.Range("A1:D38")
Set-Border $allRange

# 눈금선 숨기기, 페이지 설정
$excel.ActiveWindow.DisplayGridlines = $false
$ws.PageSetup.Orientation = 1
$ws.PageSetup.FitToPagesWide = 1
$ws.PageSetup.FitToPagesTall = 1

$wb.SaveAs($outPath, 51)  # 51 = xlOpenXMLWorkbook (.xlsx)
$wb.Close($false)
$excel.Quit()

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ws) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()
[GC]::WaitForPendingFinalizers()

Write-Output "DONE: $outPath"
