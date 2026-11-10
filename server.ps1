# 매일경제 콘텐츠 구매 안내 사이트 - 로컬 개발 서버
# 정적 파일 서빙 + 문의 폼 제출(POST /api/inquiry)을 로컬 CSV(스프레드시트 대용)에 적재합니다.
# $AppsScriptUrl 을 설정하면, 제출 건을 Google Apps Script 웹앱으로도 전달해
# 실제 Google Sheets 적재 + 담당자 이메일 알림까지 함께 처리합니다. (scripts/AppsScript.gs 참고)

param(
    [int]$Port = 8000
)

# 배포한 Google Apps Script 웹앱 URL을 여기에 붙여넣으세요. (예: https://script.google.com/macros/s/xxxx/exec)
$AppsScriptUrl = "https://script.google.com/macros/s/AKfycbx6XwLC7NXJx5qnaRWcpgL9VYlX45qW19lIvPvOZwmDH4H4XnOz0sn0vihbYvDtRXLzHw/exec"

$root = $PSScriptRoot
$dataDir = Join-Path $root "data"
$csvPath = Join-Path $dataDir "inquiries.csv"
$applicationCsvPath = Join-Path $dataDir "applications.csv"

if (-not [System.IO.Directory]::Exists($dataDir)) { [System.IO.Directory]::CreateDirectory($dataDir) | Out-Null }

$csvHeader = "접수일시,기사링크,사용목적(대분류),사용목적(상세),특이사항,특이사항여부,기타문의,회사명,담당자명,연락처/이메일,처리상태"
if (-not [System.IO.File]::Exists($csvPath)) {
    [System.IO.File]::WriteAllText($csvPath, $csvHeader + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
}

$applicationCsvHeader = "접수일시,법인명,사업자등록번호,주소,전화,담당자명,e-mail,기사목록,사용목적,특이사항,세금계산서메일,청구액,처리상태,허가서발송일시"
if (-not [System.IO.File]::Exists($applicationCsvPath)) {
    [System.IO.File]::WriteAllText($applicationCsvPath, $applicationCsvHeader + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
}

function ConvertTo-CsvField($value) {
    if ($null -eq $value) { $value = "" }
    $value = [string]$value
    if ($value -match '[",\r\n]') {
        $value = '"' + ($value -replace '"', '""') + '"'
    }
    return $value
}

function Send-ToAppsScript($rawBody) {
    if (-not $AppsScriptUrl) { return $null }
    try {
        $forwardBytes = [System.Text.Encoding]::UTF8.GetBytes($rawBody)
        return Invoke-RestMethod -Uri $AppsScriptUrl -Method Post -Body $forwardBytes -ContentType "application/json; charset=utf-8"
    }
    catch {
        Write-Warning ("Apps Script 전달 실패 (로컬 CSV 저장은 완료됨): " + $_.Exception.Message)
        return $null
    }
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "매일경제 콘텐츠 구매 안내 서버 실행 중: $prefix"
Write-Output "문의 데이터 저장 위치: $csvPath"
Write-Output "신청서 데이터 저장 위치: $applicationCsvPath"
Write-Output "종료하려면 Ctrl+C 를 누르세요."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($path -eq "/") { $path = "/index.html" }

            if ($request.HttpMethod -eq "POST" -and $path -eq "/api/inquiry") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $json = $body | ConvertFrom-Json

                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $hasSpecialNote = -not [string]::IsNullOrWhiteSpace($json.specialNote)

                $fields = @(
                    $timestamp,
                    $json.articleUrl,
                    $json.purposeCategory,
                    $json.purposeDetail,
                    $json.specialNote,
                    $(if ($hasSpecialNote) { "TRUE" } else { "FALSE" }),
                    $json.etcInquiry,
                    $json.companyName,
                    $json.managerName,
                    $json.contact,
                    "신규"
                ) | ForEach-Object { ConvertTo-CsvField $_ }

                $line = ($fields -join ",") + "`r`n"
                [System.IO.File]::AppendAllText($csvPath, $line, (New-Object System.Text.UTF8Encoding($false)))

                $appsScriptResult = Send-ToAppsScript $body

                if ($appsScriptResult -and $appsScriptResult.success -eq $false) {
                    Write-Warning ("Apps Script가 오류를 반환함: " + $appsScriptResult.error)
                    $responseObj = @{ success = $false; error = $appsScriptResult.error }
                }
                else {
                    $responseObj = @{ success = $true; sheetsSynced = ($null -ne $appsScriptResult) }
                }
                $responseBody = $responseObj | ConvertTo-Json -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
                $response.ContentType = "application/json; charset=utf-8"
                $response.StatusCode = 200
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            elseif ($request.HttpMethod -eq "POST" -and $path -eq "/api/application") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $json = $body | ConvertFrom-Json

                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $articlesJson = $json.articles | ConvertTo-Json -Compress -Depth 5

                $fields = @(
                    $timestamp,
                    $json.companyName,
                    $json.bizRegNo,
                    $json.address,
                    $json.phone,
                    $json.managerName,
                    $json.email,
                    $articlesJson,
                    $json.purpose,
                    $json.specialNote,
                    $json.taxInvoiceEmail,
                    "",
                    "접수",
                    ""
                ) | ForEach-Object { ConvertTo-CsvField $_ }

                $line = ($fields -join ",") + "`r`n"
                [System.IO.File]::AppendAllText($applicationCsvPath, $line, (New-Object System.Text.UTF8Encoding($false)))

                $appsScriptResult = Send-ToAppsScript $body

                if ($appsScriptResult -and $appsScriptResult.success -eq $false) {
                    Write-Warning ("Apps Script가 오류를 반환함: " + $appsScriptResult.error)
                    $responseObj = @{ success = $false; error = $appsScriptResult.error }
                }
                elseif ($appsScriptResult -and $appsScriptResult.pdfBase64) {
                    $responseObj = @{ success = $true; pdfBase64 = $appsScriptResult.pdfBase64; pdfFileName = $appsScriptResult.pdfFileName }
                }
                else {
                    $responseObj = @{ success = $true }
                }
                $responseBody = $responseObj | ConvertTo-Json -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
                $response.ContentType = "application/json; charset=utf-8"
                $response.StatusCode = 200
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            else {
                $filePath = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
                if ([System.IO.File]::Exists($filePath)) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $response.ContentType = $contentType
                    $response.StatusCode = 200
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                else {
                    $response.StatusCode = 404
                    $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                    $response.OutputStream.Write($notFound, 0, $notFound.Length)
                }
            }
        }
        catch {
            $response.StatusCode = 500
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: " + $_.Exception.Message)
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        finally {
            $response.OutputStream.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
