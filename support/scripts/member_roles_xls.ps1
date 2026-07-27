param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("export", "import")]
  [string]$Mode,

  [string]$Scenario = "scenario_6",
  [Parameter(Mandatory = $true)]
  [string]$Group,
  [string]$WorkbookPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $scriptDir = $PSScriptRoot
  return [string](Resolve-Path -LiteralPath (Join-Path $scriptDir "..\.."))
}

function Read-JsonFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    $Value
  )
  $json = $Value | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, ($json + "`n"), [System.Text.UTF8Encoding]::new($false))
}

function Get-SafeFileStem {
  param([string]$Value)
  $safe = [string]$Value
  foreach ($ch in [System.IO.Path]::GetInvalidFileNameChars()) {
    $safe = $safe.Replace($ch, "_")
  }
  return ($safe -replace "\s+", "_")
}

function Normalize-RoleExportValue {
  param($Value)
  if ($null -eq $Value) { return "" }
  $num = 0.0
  if (-not [double]::TryParse([string]$Value, [ref]$num)) { return "" }
  if ($num -le 0) { return "" }
  if ($num -le 1) {
    $scaled = [math]::Round($num * 5)
    if ($scaled -lt 1) { return "" }
    return [int][math]::Min(5, [math]::Max(1, $scaled))
  }
  if ($num -le 5) {
    return [int][math]::Min(5, [math]::Max(1, [math]::Round($num)))
  }
  if ($num -le 100) {
    $scaled = [math]::Round($num / 20)
    if ($scaled -lt 1) { return "" }
    return [int][math]::Min(5, [math]::Max(1, $scaled))
  }
  return 5
}

function Normalize-RoleImportValue {
  param($Value)
  if ($null -eq $Value) { return $null }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  $num = 0.0
  if (-not [double]::TryParse($text, [ref]$num)) { return $null }
  if ($num -le 0) { return $null }
  return [int][math]::Min(5, [math]::Max(1, [math]::Round($num)))
}

function Get-RoleColumns {
  return @(
    "leader",
    "center",
    "lead_singer",
    "lead_dancer",
    "host",
    "content",
    "streaming",
    "style",
    "call_leader"
  )
}

function Normalize-RoleKey {
  param([string]$Key)
  switch ($Key) {
    "performance_center" { return "center" }
    "content_lead" { return "content" }
    "youtuber" { return "content" }
    "youtube" { return "content" }
    "sns" { return "content" }
    "sns_lead" { return "content" }
    "social_media" { return "content" }
    "snser" { return "content" }
    "x" { return "content" }
    "twitter" { return "content" }
    "instagram" { return "content" }
    "tiktok" { return "content" }
    "livestream" { return "streaming" }
    "streamer" { return "streaming" }
    "showroom" { return "streaming" }
    "tiktok_live" { return "streaming" }
    "instagram_live" { return "streaming" }
    "youtube_live" { return "streaming" }
    "style_lead" { return "style" }
    "hype" { return "call_leader" }
    "hype_lead" { return "call_leader" }
    default { return $Key }
  }
}

function Get-ScenarioPaths {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [Parameter(Mandatory = $true)]
    [string]$ScenarioName
  )
  $scenarioRoot = Join-Path $Root ("public\data\scenarios\" + $ScenarioName)
  return @{
    IdolsPath = Join-Path $scenarioRoot "idols.json"
    GroupsPath = Join-Path $scenarioRoot "groups.json"
  }
}

function Find-GroupRow {
  param(
    [Parameter(Mandatory = $true)]
    $Groups,
    [Parameter(Mandatory = $true)]
    [string]$GroupName
  )
  $needle = $GroupName.Trim().ToLowerInvariant()
  foreach ($group in $Groups) {
    $candidates = @(
      [string]$group.name,
      [string]$group.name_romanji,
      [string]$group.nickname
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim().ToLowerInvariant() }
    if ($candidates -contains $needle) { return $group }
  }
  return $null
}

function Find-MembershipEntry {
  param(
    [Parameter(Mandatory = $true)]
    $Idol,
    [Parameter(Mandatory = $true)]
    $GroupRow
  )
  $history = @($Idol.group_history)
  foreach ($entry in $history) {
    if ([string]$entry.group_uid -eq [string]$GroupRow.uid) { return $entry }
  }
  foreach ($entry in $history) {
    if ([string]$entry.group_name -eq [string]$GroupRow.name) { return $entry }
  }
  return $null
}

function Get-EntryRoleMap {
  param($Entry)
  $out = [ordered]@{}
  if ($null -eq $Entry) { return $out }
  $source = $Entry.roles
  if ($null -eq $source) { $source = $Entry.member_roles }
  if ($null -eq $source) { $source = $Entry.role_assignments }
  if ($null -eq $source) { return $out }

  if ($source -is [System.Array]) {
    foreach ($item in $source) {
      if ($item -is [string]) { $out[(Normalize-RoleKey ([string]$item))] = 5 }
      elseif ($null -ne $item) {
        $key = ""
        foreach ($candidate in @($item.key, $item.role, $item.id)) {
          if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            $key = Normalize-RoleKey ([string]$candidate)
            break
          }
        }
        $rawWeight = $null
        foreach ($candidate in @($item.focus, $item.weight, $item.scale, 5)) {
          if ($null -ne $candidate -and -not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            $rawWeight = $candidate
            break
          }
        }
        $value = Normalize-RoleExportValue $rawWeight
        if (-not [string]::IsNullOrWhiteSpace($key) -and $value -ne "") { $out[$key] = $value }
      }
    }
    return $out
  }

  foreach ($prop in $source.PSObject.Properties) {
    $normalizedKey = Normalize-RoleKey $prop.Name
    $value = Normalize-RoleExportValue $prop.Value
    if ($value -ne "") { $out[$normalizedKey] = $value }
  }
  return $out
}

function New-ExcelApplication {
  try {
    return New-Object -ComObject Excel.Application
  } catch {
    throw "Excel COM automation is unavailable. Please make sure Microsoft Excel is installed."
  }
}

function Release-ComObject {
  param($ComObject)
  if ($null -ne $ComObject) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ComObject)
  }
}

function Export-Workbook {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkbookFile,
    [Parameter(Mandatory = $true)]
    $GroupRow,
    [Parameter(Mandatory = $true)]
    $Idols
  )

  $roleColumns = Get-RoleColumns
  $excel = $null
  $workbook = $null
  $rolesSheet = $null

  try {
    $excel = New-ExcelApplication
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Add()

    $rolesSheet = $workbook.Worksheets.Item(1)
    $rolesSheet.Name = "Roles"

    $headers = @(
      "idol_uid",
      "idol_name",
      "group_uid",
      "group_name",
      "start_date",
      "end_date",
      "member_color",
      "announced_leader"
    ) + $roleColumns + @("notes")

    for ($i = 0; $i -lt $headers.Count; $i++) {
      $rolesSheet.Cells.Item(1, $i + 1).Value2 = $headers[$i]
    }

    $memberUids = @($GroupRow.member_uids) | ForEach-Object { [string]$_ }
    $rowIndex = 2
    foreach ($uid in $memberUids) {
      $idol = $Idols | Where-Object { [string]$_.uid -eq $uid } | Select-Object -First 1
      if ($null -eq $idol) { continue }
      $entry = Find-MembershipEntry -Idol $idol -GroupRow $GroupRow
      $roleMap = Get-EntryRoleMap -Entry $entry
      $rolesSheet.Cells.Item($rowIndex, 1).Value2 = [string]$idol.uid
      $rolesSheet.Cells.Item($rowIndex, 2).Value2 = [string]$idol.name
      $rolesSheet.Cells.Item($rowIndex, 3).Value2 = [string]$GroupRow.uid
      $rolesSheet.Cells.Item($rowIndex, 4).Value2 = [string]$GroupRow.name
      $rolesSheet.Cells.Item($rowIndex, 5).Value2 = [string]($(if ($null -ne $entry) { $entry.start_date } else { "" }))
      $rolesSheet.Cells.Item($rowIndex, 6).Value2 = [string]($(if ($null -ne $entry) { $entry.end_date } else { "" }))
      $rolesSheet.Cells.Item($rowIndex, 7).Value2 = [string]($(if ($null -ne $entry) { $entry.member_color } else { "" }))
      $rolesSheet.Cells.Item($rowIndex, 8).Value2 = [bool]($(if ($null -ne $entry -and $entry.announced_leader -eq $true) { $true } else { $false }))

      for ($roleIndex = 0; $roleIndex -lt $roleColumns.Count; $roleIndex++) {
        $roleKey = $roleColumns[$roleIndex]
        $value = $roleMap[$roleKey]
        if ($null -ne $value -and $value -ne "") {
          $rolesSheet.Cells.Item($rowIndex, 9 + $roleIndex).Value2 = [string]$value
        }
      }

      $rolesSheet.Cells.Item($rowIndex, 9 + $roleColumns.Count).Value2 = [string]($(if ($null -ne $entry) { $entry.notes } else { "" }))
      $rowIndex += 1
    }

    $headerRange = $rolesSheet.Range("A1", $rolesSheet.Cells.Item(1, $headers.Count))
    $headerRange.Font.Bold = $true
    $headerRange.Interior.Color = 0xD9EAD3

    $rolesSheet.Range("A:A").NumberFormat = "@"
    $rolesSheet.Range("B:B").NumberFormat = "@"
    $rolesSheet.Range("C:C").NumberFormat = "@"
    $rolesSheet.Range("D:D").NumberFormat = "@"
    $rolesSheet.Range("E:F").NumberFormat = "@"
    $rolesSheet.Range("G:G").NumberFormat = "@"
    $rolesSheet.Range("T:T").NumberFormat = "@"

    if ($rowIndex -gt 2) {
      for ($checkboxRow = 2; $checkboxRow -le ($rowIndex - 1); $checkboxRow += 1) {
        $cell = $rolesSheet.Cells.Item($checkboxRow, 8)
        $left = [double]$cell.Left + 4
        $top = [double]$cell.Top + 2
        $width = [double]$cell.Width - 8
        $height = [double]$cell.Height - 4
        $checkBox = $rolesSheet.CheckBoxes().Add($left, $top, $width, $height)
        $checkBox.Caption = ""
        $checkBox.LinkedCell = $cell.Address($false, $false)
        $checkBox.Value = $(if ([bool]$cell.Value2) { 1 } else { -4146 })
      }
      $rolesSheet.Range("H:H").ColumnWidth = 12
    }

    if ($rowIndex -gt 2) {
      $firstRoleColumn = 9
      $lastRoleColumn = $firstRoleColumn + $roleColumns.Count - 1
      $validationRange = $rolesSheet.Range($rolesSheet.Cells.Item(2, $firstRoleColumn), $rolesSheet.Cells.Item($rowIndex - 1, $lastRoleColumn))
      $null = $validationRange.Validation.Delete()
      $validationRange.Validation.Add(3, 1, 1, "0,1,2,3,4,5")
      $validationRange.Validation.IgnoreBlank = $true
      $validationRange.Validation.InCellDropdown = $true
      $validationRange.Validation.InputTitle = "Role Weight"
      $validationRange.Validation.InputMessage = "Select 0-5, or leave blank if the role does not apply. 0 is treated as no role."
      $validationRange.Validation.ErrorTitle = "Invalid Weight"
      $validationRange.Validation.ErrorMessage = "Role weights must be blank or one of 0, 1, 2, 3, 4, 5."
    }

    $rolesSheet.Rows.Item(2).Select() | Out-Null
    $excel.ActiveWindow.FreezePanes = $true
    $rolesSheet.UsedRange.Columns.AutoFit() | Out-Null
    $rolesSheet.UsedRange.AutoFilter() | Out-Null

    $extension = [System.IO.Path]::GetExtension($WorkbookFile).ToLowerInvariant()
    $fileFormat = if ($extension -eq ".xls") { 56 } else { 51 }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $WorkbookFile)
    if (Test-Path -LiteralPath $WorkbookFile) {
      Remove-Item -LiteralPath $WorkbookFile -Force
    }
    if ($extension -eq ".xlsx") {
      $workbook.SaveCopyAs([string]$WorkbookFile)
    } else {
      $missing = [System.Type]::Missing
      $workbook.SaveAs(
        [string]$WorkbookFile,
        $fileFormat,
        $missing,
        $missing,
        $false,
        $false,
        1,
        $missing,
        $false,
        $missing,
        $missing,
        $true
      )
    }
    $workbook.Saved = $true
  } finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    Release-ComObject $rolesSheet
    Release-ComObject $workbook
    Release-ComObject $excel
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Import-Workbook {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkbookFile,
    [Parameter(Mandatory = $true)]
    $GroupRow,
    [Parameter(Mandatory = $true)]
    $Idols
  )

  if (-not (Test-Path -LiteralPath $WorkbookFile)) {
    throw "Workbook not found: $WorkbookFile"
  }

  $roleColumns = Get-RoleColumns
  $excel = $null
  $workbook = $null
  $rolesSheet = $null

  try {
    $excel = New-ExcelApplication
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($WorkbookFile)
    $rolesSheet = $workbook.Worksheets.Item("Roles")
    $usedRange = $rolesSheet.UsedRange
    $rowCount = $usedRange.Rows.Count
    $colCount = $usedRange.Columns.Count

    $headers = @{}
    for ($col = 1; $col -le $colCount; $col += 1) {
      $header = [string]$rolesSheet.Cells.Item(1, $col).Text
      if (-not [string]::IsNullOrWhiteSpace($header)) {
        $headers[$header.Trim()] = $col
      }
    }
    if (-not $headers.ContainsKey("idol_uid")) {
      throw "Workbook is missing the idol_uid column."
    }

    $updated = 0
    for ($row = 2; $row -le $rowCount; $row += 1) {
      $uid = [string]$rolesSheet.Cells.Item($row, $headers["idol_uid"]).Text
      if ([string]::IsNullOrWhiteSpace($uid)) { continue }
      $idol = $Idols | Where-Object { [string]$_.uid -eq $uid.Trim() } | Select-Object -First 1
      if ($null -eq $idol) { continue }
      $entry = Find-MembershipEntry -Idol $idol -GroupRow $GroupRow
      if ($null -eq $entry) { continue }

      $roleMap = [ordered]@{}
      $announcedLeaderRaw = [string]$rolesSheet.Cells.Item($row, $headers["announced_leader"]).Value2
      $announcedLeader = $false
      if (-not [string]::IsNullOrWhiteSpace($announcedLeaderRaw)) {
        $announcedLeader = @("true", "1", "-1") -contains $announcedLeaderRaw.Trim().ToLowerInvariant()
      }
      foreach ($roleKey in $roleColumns) {
        if (-not $headers.ContainsKey($roleKey)) { continue }
        $raw = $rolesSheet.Cells.Item($row, $headers[$roleKey]).Text
        $weight = Normalize-RoleImportValue $raw
        if ($null -ne $weight) {
          $roleMap[$roleKey] = $weight
        }
      }

      if ($roleMap.Count -gt 0) {
        $entry | Add-Member -NotePropertyName roles -NotePropertyValue $roleMap -Force
      } else {
        $entry.PSObject.Properties.Remove("roles")
      }
      if ($announcedLeader) {
        $entry | Add-Member -NotePropertyName announced_leader -NotePropertyValue $true -Force
      } else {
        $entry.PSObject.Properties.Remove("announced_leader")
      }
      $updated += 1
    }

    return $updated
  } finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    Release-ComObject $rolesSheet
    Release-ComObject $workbook
    Release-ComObject $excel
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

$root = Get-RepoRoot
$paths = Get-ScenarioPaths -Root $root -ScenarioName $Scenario
$groups = Read-JsonFile -Path $paths.GroupsPath
$idols = Read-JsonFile -Path $paths.IdolsPath
$groupRow = Find-GroupRow -Groups $groups -GroupName $Group
if ($null -eq $groupRow) {
  throw "Group not found: $Group"
}

if ([string]::IsNullOrWhiteSpace($WorkbookPath)) {
  $WorkbookPath = Join-Path $root ("support\docs\reference\{0}_{1}_member_roles.xlsx" -f $Scenario, (Get-SafeFileStem $groupRow.name))
}

if ($Mode -eq "export") {
  Export-Workbook -WorkbookFile $WorkbookPath -GroupRow $groupRow -Idols $idols
  $resolvedWorkbookPath = [string](Resolve-Path -LiteralPath $WorkbookPath)
  Write-Host ("Wrote workbook to {0}" -f $resolvedWorkbookPath)
} else {
  $updated = Import-Workbook -WorkbookFile $WorkbookPath -GroupRow $groupRow -Idols $idols
  Write-JsonFile -Path $paths.IdolsPath -Value $idols
  Write-Host ("Imported roles for {0} members into {1}" -f $updated, $paths.IdolsPath)
}
