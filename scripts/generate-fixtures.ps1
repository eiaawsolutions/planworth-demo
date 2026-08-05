# Generates the document fixtures used by the Intelligent Document Processing
# scenario, into public/fixtures/.
#
# These are rendered as page images rather than clean digital PDFs on purpose:
# the deck frames scenario 3 as OCR + NLP, and extracting from a rendered (and in
# one case deliberately degraded) page is a fair demonstration of that, whereas
# pulling a text layer out of a generated PDF would not be.
#
# Every company, reference and figure below is fictional. progress-claim-1024
# reproduces the worked example printed on slide 8 of the brief.
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File scripts/generate-fixtures.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$outDir = Join-Path $PSScriptRoot "..\public\fixtures"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$W = 1000
# Deliberately shorter than A4 proportion: these fixtures are single-page
# financial documents whose content ends well above the fold, and a tall page
# would be mostly dead white space on screen (and, once grain is applied to the
# scanned fixture, mostly dead file size too).
$H = 900

# ── Fonts ───────────────────────────────────────────────────────
$fTitle   = New-Object System.Drawing.Font("Arial", 19, [System.Drawing.FontStyle]::Bold)
$fIssuer  = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)
$fSmall   = New-Object System.Drawing.Font("Arial", 9)
$fBody    = New-Object System.Drawing.Font("Arial", 10.5)
$fBodyB   = New-Object System.Drawing.Font("Arial", 10.5, [System.Drawing.FontStyle]::Bold)
$fLabel   = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Bold)
$fMono    = New-Object System.Drawing.Font("Consolas", 11)
$fMonoB   = New-Object System.Drawing.Font("Consolas", 12, [System.Drawing.FontStyle]::Bold)
$fTotal   = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)

$ink      = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 24, 28))
$inkSoft  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(96, 96, 104))
$penRule  = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(170, 170, 176), 1)
$penHeavy = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 40, 46), 2)

function Render-Document {
  param(
    [hashtable]$Doc
  )

  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear([System.Drawing.Color]::White)

  $M = 72          # page margin
  $y = 68

  # ── Issuer letterhead ──
  $g.DrawString($Doc.Issuer, $fIssuer, $ink, $M, $y)
  $y += 26
  foreach ($line in $Doc.IssuerLines) {
    $g.DrawString($line, $fSmall, $inkSoft, $M, $y)
    $y += 14
  }

  # Document type, right aligned-ish
  $g.DrawString($Doc.Title, $fTitle, $ink, ($W - $M - 330), 68)
  $g.DrawString($Doc.Subtitle, $fSmall, $inkSoft, ($W - $M - 330), 96)

  $y += 14
  $g.DrawLine($penHeavy, $M, $y, ($W - $M), $y)
  $y += 26

  # ── Reference / date block ──
  $col2 = 520
  $g.DrawString($Doc.RefLabel.ToUpper(), $fLabel, $inkSoft, $M, $y)
  $g.DrawString("DATE", $fLabel, $inkSoft, $col2, $y)
  $y += 16
  $g.DrawString($Doc.RefValue, $fMonoB, $ink, $M, $y)
  $g.DrawString($Doc.DateValue, $fMono, $ink, $col2, $y)
  $y += 30

  $g.DrawString($Doc.PartyLabel.ToUpper(), $fLabel, $inkSoft, $M, $y)
  if ($Doc.ContractRef) { $g.DrawString("CONTRACT REFERENCE", $fLabel, $inkSoft, $col2, $y) }
  $y += 16
  $g.DrawString($Doc.PartyName, $fBodyB, $ink, $M, $y)
  if ($Doc.ContractRef) { $g.DrawString($Doc.ContractRef, $fMono, $ink, $col2, $y) }
  $y += 17
  foreach ($line in $Doc.PartyLines) {
    $g.DrawString($line, $fSmall, $inkSoft, $M, $y)
    $y += 14
  }

  $y += 22

  # ── Optional preamble (letters of award) ──
  if ($Doc.Preamble) {
    foreach ($line in $Doc.Preamble) {
      $g.DrawString($line, $fBody, $ink, $M, $y)
      $y += 19
    }
    $y += 16
  }

  # ── Line-item table ──
  $tableTop = $y
  $g.DrawLine($penRule, $M, $y, ($W - $M), $y)
  $y += 8
  $g.DrawString("DESCRIPTION", $fLabel, $inkSoft, $M, $y)
  $g.DrawString("AMOUNT (RM)", $fLabel, $inkSoft, ($W - $M - 130), $y)
  $y += 18
  $g.DrawLine($penRule, $M, $y, ($W - $M), $y)
  $y += 12

  foreach ($item in $Doc.Items) {
    $g.DrawString($item.Text, $fBody, $ink, $M, $y)
    $amountStr = $item.Amount
    $size = $g.MeasureString($amountStr, $fMono)
    $g.DrawString($amountStr, $fMono, $ink, ($W - $M - $size.Width), $y)
    $y += 24
  }

  $y += 6
  $g.DrawLine($penRule, ($W - $M - 300), $y, ($W - $M), $y)
  $y += 12

  # ── Total ──
  $totalLabel = $Doc.TotalLabel
  $g.DrawString($totalLabel, $fBodyB, $ink, ($W - $M - 300), $y)
  $tSize = $g.MeasureString($Doc.Total, $fTotal)
  $g.DrawString($Doc.Total, $fTotal, $ink, ($W - $M - $tSize.Width), ($y - 4))
  $y += 34
  $g.DrawLine($penHeavy, ($W - $M - 300), $y, ($W - $M), $y)

  $y += 60

  # ── Certification / signature block ──
  if ($Doc.CertLines) {
    foreach ($line in $Doc.CertLines) {
      $g.DrawString($line, $fSmall, $inkSoft, $M, $y)
      $y += 15
    }
    $y += 40
  }

  $sigY = [Math]::Min($y, $H - 190)
  $g.DrawLine($penRule, $M, $sigY, ($M + 250), $sigY)
  $g.DrawString($Doc.SignatoryLine1, $fSmall, $inkSoft, $M, ($sigY + 6))
  $g.DrawString($Doc.SignatoryLine2, $fSmall, $inkSoft, $M, ($sigY + 21))

  if ($Doc.StampText) {
    $g.DrawLine($penRule, ($W - $M - 250), $sigY, ($W - $M), $sigY)
    $g.DrawString($Doc.StampText, $fSmall, $inkSoft, ($W - $M - 250), ($sigY + 6))
    $g.DrawString($Doc.StampSub, $fSmall, $inkSoft, ($W - $M - 250), ($sigY + 21))
  }

  # ── Page footer ──
  $g.DrawString(
    "FICTIONAL DEMONSTRATION DOCUMENT - EIAAW SOLUTIONS - NOT A REAL FINANCIAL RECORD",
    $fSmall, $inkSoft, $M, ($H - 60))

  $g.Dispose()
  return $bmp
}

function ConvertTo-Scan {
  # Simulates a phone-photographed / faxed page: slight skew, warm-grey paper,
  # sensor grain, reduced contrast, and a couple of specks. This is what makes
  # the mismatch fixture a genuine extraction test rather than clean text.
  param([System.Drawing.Bitmap]$Source, [double]$AngleDeg = -1.6)

  $out = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(232, 229, 222))

  # Rotate about the page centre and inset slightly, as if the page were not
  # square to the platen.
  $g.TranslateTransform($W / 2, $H / 2)
  $g.RotateTransform($AngleDeg)
  $g.TranslateTransform(-$W / 2, -$H / 2)
  $g.DrawImage($Source, 14, 10, ($W - 28), ($H - 20))
  $g.ResetTransform()
  $g.Dispose()

  # Grain + contrast loss, applied per pixel.
  $rand = New-Object System.Random(20260805)
  for ($y = 0; $y -lt $H; $y += 1) {
    for ($x = 0; $x -lt $W; $x += 1) {
      $c = $out.GetPixel($x, $y)
      $n = $rand.Next(-13, 14)
      # Lift blacks and drop whites slightly — classic scan contrast crush.
      $r = [Math]::Max(0, [Math]::Min(255, [int]($c.R * 0.93 + 12 + $n)))
      $gg = [Math]::Max(0, [Math]::Min(255, [int]($c.G * 0.93 + 11 + $n)))
      $b = [Math]::Max(0, [Math]::Min(255, [int]($c.B * 0.93 + 8 + $n)))
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($r, $gg, $b))
    }
  }

  # A few dust specks.
  $gd = [System.Drawing.Graphics]::FromImage($out)
  $speck = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 70, 75))
  foreach ($i in 1..26) {
    $sx = $rand.Next(0, $W); $sy = $rand.Next(0, $H); $sz = $rand.Next(1, 4)
    $gd.FillEllipse($speck, $sx, $sy, $sz, $sz)
  }
  $gd.Dispose()

  return $out
}

# ─────────────────────────────────────────────────────────────
# The five fixtures
# ─────────────────────────────────────────────────────────────

$fixtures = @()

# 1 — the worked example printed on slide 8 of the brief.
$fixtures += @{
  File = "progress-claim-1024.png"
  Scan = $false
  Doc  = @{
    Issuer      = "BINA HARMONI SDN BHD"
    IssuerLines = @("Company No. 202201004821", "Lot 4, Jalan Perindustrian Sungai Buloh, 47000 Selangor", "T +60 3 6140 2288   acc@binaharmoni.example")
    Title       = "CONTRACT PROGRESS CLAIM"
    Subtitle    = "Interim claim - submitted for certification"
    RefLabel    = "Invoice No."
    RefValue    = "1024"
    DateValue   = "25 OCT 2024"
    PartyLabel  = "Customer"
    PartyName   = "ACME CORP"
    PartyLines  = @("Accounts Payable Department")
    ContractRef = "AC/2024/1024"
    Items       = @(
      @{ Text = "Works completed to date - as per attached schedule"; Amount = "46,500.00" },
      @{ Text = "Materials on site"; Amount = "3,500.00" }
    )
    TotalLabel  = "TOTAL"
    Total       = "50,000.00"
    CertLines   = @("Claim submitted in accordance with the contract payment schedule.")
    SignatoryLine1 = "Prepared by: Contracts Department"
    SignatoryLine2 = "Bina Harmoni Sdn Bhd"
    StampText   = "Certified by"
    StampSub    = "Consultant / Quantity Surveyor"
  }
}

# 2 — a clean Malaysian invoice that should reconcile.
$fixtures += @{
  File = "invoice-8871.png"
  Scan = $false
  Doc  = @{
    Issuer      = "TEGAS ELEKTRIK SDN BHD"
    IssuerLines = @("Company No. 201901022114", "No. 18, Jalan Teknologi 3/5, Kota Damansara, 47810 Selangor", "SST No. W10-1809-31000045")
    Title       = "TAX INVOICE"
    Subtitle    = "Mechanical & electrical works"
    RefLabel    = "Invoice No."
    RefValue    = "INV-8871"
    DateValue   = "12 MARCH 2026"
    PartyLabel  = "Bill to"
    PartyName   = "Jabatan Kerja Raya Selangor"
    PartyLines  = @("Tingkat 3, Bangunan Sultan Salahuddin Abdul Aziz Shah", "40000 Shah Alam, Selangor")
    ContractRef = "JKR/S/2025/118-ME"
    Items       = @(
      @{ Text = "Supply and installation of LV distribution boards"; Amount = "218,400.00" },
      @{ Text = "Cable containment and final circuits - Block B"; Amount = "191,700.00" },
      @{ Text = "Testing, commissioning and as-built documentation"; Amount = "76,200.00" }
    )
    TotalLabel  = "TOTAL DUE"
    Total       = "486,300.00"
    CertLines   = @("Payment terms: 60 days from date of certification.")
    SignatoryLine1 = "Authorised signatory"
    SignatoryLine2 = "Tegas Elektrik Sdn Bhd"
    StampText   = "Received by"
    StampSub    = "JKR Selangor - Project Office"
  }
}

# 3 — THE DELIBERATE MISMATCH, as a degraded scan.
#     Certified claim reads 742,500.00; the CRM record declares 724,500.00.
$fixtures += @{
  File = "progress-claim-3302-scan.png"
  Scan = $true
  Doc  = @{
    Issuer      = "TEGAS ELEKTRIK SDN BHD"
    IssuerLines = @("Company No. 201901022114", "No. 18, Jalan Teknologi 3/5, Kota Damansara, 47810 Selangor")
    Title       = "CERTIFIED PROGRESS CLAIM"
    Subtitle    = "Interim certificate No. 7"
    RefLabel    = "Claim No."
    RefValue    = "PC-3302"
    DateValue   = "28 FEB 2026"
    PartyLabel  = "Awarding party"
    PartyName   = "MRT Corp Sdn Bhd"
    PartyLines  = @("Level 5, Menara MRT, Jalan Bangsar", "59200 Kuala Lumpur")
    ContractRef = "MRTC/PKG/2025/44"
    Items       = @(
      @{ Text = "Value of works executed to date"; Amount = "6,842,000.00" },
      @{ Text = "Less: previously certified"; Amount = "(6,099,500.00)" }
    )
    TotalLabel  = "AMOUNT CERTIFIED"
    Total       = "742,500.00"
    CertLines   = @(
      "Certified in accordance with Clause 28 of the contract conditions.",
      "This certificate supersedes all previous interim certificates for this period."
    )
    SignatoryLine1 = "Superintending Officer"
    SignatoryLine2 = "MRT Corp Sdn Bhd"
    StampText   = "Quantity Surveyor"
    StampSub    = "Reg. No. QS/2019/0871"
  }
}

# 4 — a purchase order.
$fixtures += @{
  File = "purchase-order-44127.png"
  Scan = $false
  Doc  = @{
    Issuer      = "TENAGA NASIONAL BERHAD"
    IssuerLines = @("Procurement Division", "No. 129, Jalan Bangsar, 59200 Kuala Lumpur")
    Title       = "PURCHASE ORDER"
    Subtitle    = "This order is subject to TNB general conditions"
    RefLabel    = "Purchase Order No."
    RefValue    = "TNB/PO/2026/44127"
    DateValue   = "6 JANUARY 2026"
    PartyLabel  = "Supplier"
    PartyName   = "Perdana Supply Chain Sdn Bhd"
    PartyLines  = @("Company No. 201703001248", "Lot 22, Jalan Industri Bukit Raja, 41050 Klang, Selangor")
    ContractRef = $null
    Items       = @(
      @{ Text = "11kV XLPE cable, 3C x 240mm2 - 4,000 m"; Amount = "812,000.00" },
      @{ Text = "Cable jointing kits and terminations"; Amount = "263,000.00" },
      @{ Text = "Delivery to Bukit Raja substation site"; Amount = "175,000.00" }
    )
    TotalLabel  = "ORDER VALUE"
    Total       = "1,250,000.00"
    CertLines   = @("Delivery required within 90 days of order date.", "Payment 60 days from receipt of goods and valid invoice.")
    SignatoryLine1 = "Approved by: Procurement Manager"
    SignatoryLine2 = "Tenaga Nasional Berhad"
    StampText   = "Supplier acknowledgement"
    StampSub    = "Sign and return one copy"
  }
}

# 5 — a letter of award.
$fixtures += @{
  File = "letter-of-award-118.png"
  Scan = $false
  Doc  = @{
    Issuer      = "JABATAN KERJA RAYA SELANGOR"
    IssuerLines = @("Tingkat 3, Bangunan Sultan Salahuddin Abdul Aziz Shah", "40000 Shah Alam, Selangor Darul Ehsan")
    Title       = "LETTER OF AWARD"
    Subtitle    = "Surat Setuju Terima"
    RefLabel    = "Reference"
    RefValue    = "JKR/S/2025/118"
    DateValue   = "19 NOVEMBER 2025"
    PartyLabel  = "Awarded to"
    PartyName   = "Bina Harmoni Sdn Bhd"
    PartyLines  = @("Company No. 202201004821", "Lot 4, Jalan Perindustrian Sungai Buloh, 47000 Selangor")
    ContractRef = $null
    Preamble    = @(
      "We are pleased to inform you that your tender for the works described below has been",
      "accepted. You are required to commence works within fourteen (14) days of the date of",
      "this letter and to furnish a performance bond equivalent to five per cent (5%) of the",
      "contract sum prior to commencement."
    )
    Items       = @(
      @{ Text = "Proposed upgrading of district office building - Phase 1"; Amount = "2,940,000.00" },
      @{ Text = "External works, drainage and landscaping"; Amount = "540,000.00" }
    )
    TotalLabel  = "CONTRACT SUM"
    Total       = "3,480,000.00"
    CertLines   = @("Contract period: 18 months from date of site possession.", "Retention: 5% of each interim payment, capped at 2.5% of contract sum.")
    SignatoryLine1 = "Pengarah"
    SignatoryLine2 = "Jabatan Kerja Raya Selangor"
    StampText   = "Accepted by contractor"
    StampSub    = "Name, signature, company stamp, date"
  }
}

# ─────────────────────────────────────────────────────────────

foreach ($f in $fixtures) {
  Write-Output ("rendering {0}" -f $f.File)
  $bmp = Render-Document -Doc $f.Doc
  if ($f.Scan) {
    $scanned = ConvertTo-Scan -Source $bmp
    $bmp.Dispose()
    $bmp = $scanned
  }
  $path = Join-Path $outDir $f.File
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $size = (Get-Item $path).Length
  Write-Output ("  -> {0}  ({1:N0} bytes)" -f $path, $size)
}

Write-Output "done."
