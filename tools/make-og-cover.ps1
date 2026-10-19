Add-Type -AssemblyName System.Drawing

$w = 1200
$h = 630
$out = "d:\Cursor project\docs\assets\img\og-cover.png"

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 背景渐变
$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$c1 = [System.Drawing.Color]::FromArgb(255, 255, 138, 46)
$c2 = [System.Drawing.Color]::FromArgb(255, 226, 27, 78)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [single]35)
$g.FillRectangle($bg, $rect)

# 右上角柔光
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(760, -220, 700, 700)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 255, 255, 255)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
$g.FillPath($glowBrush, $glowPath)

# 卡片
$cardX = 80
$cardY = 96
$cardW = 1040
$cardH = 438
$r = 36
$card = New-Object System.Drawing.Drawing2D.GraphicsPath
$card.AddArc($cardX, $cardY, $r, $r, 180, 90)
$card.AddArc($cardX + $cardW - $r, $cardY, $r, $r, 270, 90)
$card.AddArc($cardX + $cardW - $r, $cardY + $cardH - $r, $r, $r, 0, 90)
$card.AddArc($cardX, $cardY + $cardH - $r, $r, $r, 90, 90)
$card.CloseFigure()
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(247, 255, 255, 255))
$g.FillPath($cardBrush, $card)

# 图标
$iconX = 128
$iconY = 142
$iconSize = 96
$icon = New-Object System.Drawing.Drawing2D.GraphicsPath
$icon.AddArc($iconX, $iconY, 26, 26, 180, 90)
$icon.AddArc($iconX + $iconSize - 26, $iconY, 26, 26, 270, 90)
$icon.AddArc($iconX + $iconSize - 26, $iconY + $iconSize - 26, 26, 26, 0, 90)
$icon.AddArc($iconX, $iconY + $iconSize - 26, 26, 26, 90, 90)
$icon.CloseFigure()
$iconRect = New-Object System.Drawing.Rectangle($iconX, $iconY, $iconSize, $iconSize)
$iconBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($iconRect, [System.Drawing.Color]::FromArgb(255, 255, 122, 24), [System.Drawing.Color]::FromArgb(255, 255, 45, 85), [single]45)
$g.FillPath($iconBrush, $icon)

$arrowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 5)
$arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($arrowPen, $iconX + 48, $iconY + 26, $iconX + 48, $iconY + 58)
$g.DrawLine($arrowPen, $iconX + 34, $iconY + 45, $iconX + 48, $iconY + 59)
$g.DrawLine($arrowPen, $iconX + 62, $iconY + 45, $iconX + 48, $iconY + 59)
$g.DrawLine($arrowPen, $iconX + 32, $iconY + 72, $iconX + 64, $iconY + 72)

# 标题
$titleFont = New-Object System.Drawing.Font("Microsoft YaHei UI", 40, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subFont = New-Object System.Drawing.Font("Microsoft YaHei UI", 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$tagFont = New-Object System.Drawing.Font("Microsoft YaHei UI", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$darkText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 24, 29))
$midText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 91, 98, 112))
$brandText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 60, 40))

$g.DrawString("电商图片提取下载器", $titleFont, $darkText, 250, 148)
$g.DrawString("一键提取淘宝 / 天猫、京东、拼多多商品图片", $subFont, $midText, 250, 218)
$g.DrawString("勾选后批量保存为真正的 PNG，全部在本地完成", $subFont, $midText, 250, 262)

# 标签
$tags = @("整页抓取", "自动还原原图", "PNG 输出", "数据不上传")
$x = 250
$y = 350
foreach ($t in $tags) {
  $size = $g.MeasureString($t, $tagFont)
  $tw = [int]$size.Width + 44
  $th = 50
  $tagPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tr = 25
  $tagPath.AddArc($x, $y, $tr * 2, $tr * 2, 180, 90)
  $tagPath.AddArc($x + $tw - $tr * 2, $y, $tr * 2, $tr * 2, 270, 90)
  $tagPath.AddArc($x + $tw - $tr * 2, $y + $th - $tr * 2, $tr * 2, $tr * 2, 0, 90)
  $tagPath.AddArc($x, $y + $th - $tr * 2, $tr * 2, $tr * 2, 90, 90)
  $tagPath.CloseFigure()
  $tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 240, 233))
  $g.FillPath($tagBrush, $tagPath)
  $g.DrawString($t, $tagFont, $brandText, $x + 22, $y + 11)
  $tagBrush.Dispose()
  $tagPath.Dispose()
  $x += $tw + 16
}

# 底部提示
$footFont = New-Object System.Drawing.Font("Microsoft YaHei UI", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$footBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$g.DrawString("Chrome 扩展  ·  免费  ·  Manifest V3", $footFont, $footBrush, 80, 566)

$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

$bg.Dispose(); $glowBrush.Dispose(); $glowPath.Dispose(); $card.Dispose(); $cardBrush.Dispose()
$icon.Dispose(); $iconBrush.Dispose(); $arrowPen.Dispose()
$titleFont.Dispose(); $subFont.Dispose(); $tagFont.Dispose(); $footFont.Dispose()
$darkText.Dispose(); $midText.Dispose(); $brandText.Dispose(); $footBrush.Dispose()
$g.Dispose(); $bmp.Dispose()

Write-Output ("saved: " + $out)
