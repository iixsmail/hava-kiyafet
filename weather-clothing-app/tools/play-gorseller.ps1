# Play Console mağaza kaydı için gerekli görselleri üretir.
#
# Üretilenler (hepsi store-assets/ klasörüne):
#   1. play-icon-512.png        -> Uygulama simgesi (512x512, zorunlu)
#   2. play-feature-1024x500.png -> Özellik grafiği (zorunlu)
#   3. screenshots/*.png         -> Telefon ekran görüntüleri (en az 2 zorunlu)
#
# Hiçbir harici bağımlılık yok — Windows'un kendi System.Drawing
# kütüphanesini kullanıyor. Kullanım:
#
#   pwsh -File tools/play-gorseller.ps1
#
# Ekran görüntülerini de işlemek için: telefondan aldığın PNG/JPG'leri
# tools/ham-ekran-goruntuleri/ klasörüne at, script onları Play'in kabul
# ettiği en boy oranına getirir (aşağıdaki nota bak).

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$kok          = Split-Path -Parent $PSScriptRoot
$cikti        = Join-Path $kok "store-assets"
$ekranKlas    = Join-Path $cikti "screenshots-telefon"
$tablet7Klas  = Join-Path $cikti "screenshots-tablet7"
$tablet10Klas = Join-Path $cikti "screenshots-tablet10"
$hamKlas      = Join-Path $PSScriptRoot "ham-ekran-goruntuleri"

foreach ($k in @($cikti, $ekranKlas, $tablet7Klas, $tablet10Klas)) {
    New-Item -ItemType Directory -Force $k | Out-Null
}

function Yaz([string]$m) { Write-Host $m }

# ---------------------------------------------------------------------------
# Ortak: yüksek kaliteli çizim ayarları
# ---------------------------------------------------------------------------
function Yeni-Tuval([int]$g, [int]$y) {
    $bmp = New-Object System.Drawing.Bitmap($g, $y, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    return @{ Bitmap = $bmp; Graphics = $gfx }
}

function Renk([string]$hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

# ---------------------------------------------------------------------------
# 1) UYGULAMA SİMGESİ — 512x512
#
# Kaynak ikonun kendi yuvarlatılmış kartı ve etrafında boşluk var. Play
# simgeye kendi maskesini uyguladığı için, olduğu gibi küçültürsek "çifte
# yuvarlatma" görünür ve kenarlarda ölü boşluk kalır. Bu yüzden iç kartı
# kırpıp kareyi tam dolduruyoruz.
# ---------------------------------------------------------------------------
function Uret-Simge {
    $kaynak = Join-Path $kok "assets\icon.png"
    if (-not (Test-Path $kaynak)) { throw "Kaynak ikon bulunamadı: $kaynak" }

    $src = [System.Drawing.Image]::FromFile($kaynak)
    try {
        # Kartın zemin rengini kaynaktan örnekle: kart kenarı ile beyaz
        # dairenin arasındaki ince halkadan bir piksel al.
        $bmpSrc = New-Object System.Drawing.Bitmap($src)
        try {
            $zemin = $bmpSrc.GetPixel([int]($src.Width * 0.17), [int]($src.Height * 0.5))
        } finally { $bmpSrc.Dispose() }

        # İllüstrasyonu (beyaz daire + çizim) kırp. Kartın yuvarlatılmış
        # köşelerini almıyoruz — Play zaten kendi maskesini uyguluyor,
        # ikisi üst üste gelince "çifte yuvarlatma" oluşuyordu.
        $oran  = 0.66
        $kenar = [int]([Math]::Min($src.Width, $src.Height) * $oran)
        $offX  = [int](($src.Width  - $kenar) / 2)
        $offY  = [int](($src.Height - $kenar) / 2)

        $t = Yeni-Tuval 512 512
        try {
            # Kare tamamen dolu: saydam piksel veya ölü boşluk kalmıyor.
            $fircaZemin = New-Object System.Drawing.SolidBrush $zemin
            $t.Graphics.FillRectangle($fircaZemin, 0, 0, 512, 512)
            $fircaZemin.Dispose()

            # İllüstrasyon %82 boyutta ortalanıyor — kenarlarda nefes payı
            # kalsın ki Play'in maskesi çizimi kesmesin.
            $ic  = [int](512 * 0.86)
            $pay = [int]((512 - $ic) / 2)
            $hedef = New-Object System.Drawing.Rectangle($pay, $pay, $ic, $ic)
            $kayn  = New-Object System.Drawing.Rectangle($offX, $offY, $kenar, $kenar)

            # Çizimi DAİREYE kırpıyoruz. Sebebi: kaynak kartın köşeleri
            # yuvarlatılmış, kare kırpma yapınca köşelerde kartın dışındaki
            # açık zemin küçük beyaz üçgenler halinde sızıyordu.
            # İllüstrasyon zaten dairesel olduğu için içerik kaybı yok.
            $daire = New-Object System.Drawing.Drawing2D.GraphicsPath
            $daire.AddEllipse($pay, $pay, $ic, $ic)
            $eskiKirpma = $t.Graphics.Clip
            $t.Graphics.SetClip($daire)
            $t.Graphics.DrawImage($src, $hedef, $kayn, [System.Drawing.GraphicsUnit]::Pixel)
            $t.Graphics.Clip = $eskiKirpma
            $daire.Dispose()

            $yol = Join-Path $cikti "play-icon-512.png"
            $t.Bitmap.Save($yol, [System.Drawing.Imaging.ImageFormat]::Png)
            Yaz "  OK  play-icon-512.png (512x512)"
        } finally { $t.Graphics.Dispose(); $t.Bitmap.Dispose() }
    } finally { $src.Dispose() }
}

# ---------------------------------------------------------------------------
# 2) ÖZELLİK GRAFİĞİ — 1024x500
#
# Uygulamanın gece temasıyla aynı paleti kullanıyor (mağaza sayfasıyla
# uygulama aynı kimliği taşısın diye). Play bu görselin üstüne bazı
# yerleşimlerde oynat butonu/başlık bindirdiği için metni ortadan uzak
# tutup kenarlarda güvenli boşluk bırakıyoruz.
# ---------------------------------------------------------------------------
function Uret-OzellikGrafigi {
    $g = 1024; $y = 500
    $t = Yeni-Tuval $g $y
    try {
        # Yatay gradyan: uygulamanın "açık gece" paleti
        $alan = New-Object System.Drawing.Rectangle(0, 0, $g, $y)
        $firca = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $alan, (Renk "#080D1F"), (Renk "#2E4680"),
            [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)
        $karisim = New-Object System.Drawing.Drawing2D.ColorBlend(3)
        $karisim.Colors    = @((Renk "#080D1F"), (Renk "#1B2A5B"), (Renk "#3E6BB0"))
        $karisim.Positions = @(0.0, 0.55, 1.0)
        $firca.InterpolationColors = $karisim
        $t.Graphics.FillRectangle($firca, $alan)
        $firca.Dispose()

        # Derinlik için yumuşak ışık lekeleri
        foreach ($d in @(@(760, 90, 300), @(880, 330, 220), @(120, 400, 260))) {
            $yaricap = $d[2]
            $daire = New-Object System.Drawing.Drawing2D.GraphicsPath
            $daire.AddEllipse($d[0] - $yaricap, $d[1] - $yaricap, $yaricap * 2, $yaricap * 2)
            $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($daire)
            $pgb.CenterColor    = [System.Drawing.Color]::FromArgb(38, 255, 255, 255)
            $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
            $t.Graphics.FillPath($pgb, $daire)
            $pgb.Dispose(); $daire.Dispose()
        }

        # Sol tarafa uygulama simgesi (yuvarlatılmış kare içinde)
        $simgeYol = Join-Path $cikti "play-icon-512.png"
        if (Test-Path $simgeYol) {
            $simge = [System.Drawing.Image]::FromFile($simgeYol)
            try {
                $boy = 250; $sx = 74; $sy = [int](($y - $boy) / 2)
                $r = 46
                $yol = New-Object System.Drawing.Drawing2D.GraphicsPath
                $yol.AddArc($sx, $sy, $r*2, $r*2, 180, 90)
                $yol.AddArc($sx + $boy - $r*2, $sy, $r*2, $r*2, 270, 90)
                $yol.AddArc($sx + $boy - $r*2, $sy + $boy - $r*2, $r*2, $r*2, 0, 90)
                $yol.AddArc($sx, $sy + $boy - $r*2, $r*2, $r*2, 90, 90)
                $yol.CloseFigure()

                $eskiKirpma = $t.Graphics.Clip
                $t.Graphics.SetClip($yol)
                $t.Graphics.DrawImage($simge, $sx, $sy, $boy, $boy)
                $t.Graphics.Clip = $eskiKirpma

                $kalem = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 2)
                $t.Graphics.DrawPath($kalem, $yol)
                $kalem.Dispose(); $yol.Dispose()
            } finally { $simge.Dispose() }
        }

        # Metinler
        $beyaz  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $soluk  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 255, 255, 255))
        $altin  = New-Object System.Drawing.SolidBrush (Renk "#FFC65C")

        $fBaslik = New-Object System.Drawing.Font("Segoe UI", 46, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $fAlt    = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $fRozet  = New-Object System.Drawing.Font("Segoe UI", 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

        $mx = 372
        $t.Graphics.DrawString("Hava & Kıyafet", $fBaslik, $beyaz, $mx, 160)
        $t.Graphics.DrawString("Hava durumuna göre ne giyeceğini söyler.", $fAlt, $soluk, $mx, 228)
        $t.Graphics.DrawString("7 günlük tahmin  ·  Kıyafet önerisi  ·  Reklamsız Premium", $fRozet, $altin, $mx, 278)

        # Altın vurgu çizgisi
        $cizgi = New-Object System.Drawing.SolidBrush (Renk "#FFC65C")
        $t.Graphics.FillRectangle($cizgi, $mx, 322, 96, 4)
        $cizgi.Dispose()

        $beyaz.Dispose(); $soluk.Dispose(); $altin.Dispose()
        $fBaslik.Dispose(); $fAlt.Dispose(); $fRozet.Dispose()

        $ciktiYol = Join-Path $cikti "play-feature-1024x500.png"
        $t.Bitmap.Save($ciktiYol, [System.Drawing.Imaging.ImageFormat]::Png)
        Yaz "  OK  play-feature-1024x500.png (1024x500)"
    } finally { $t.Graphics.Dispose(); $t.Bitmap.Dispose() }
}

# ---------------------------------------------------------------------------
# 3) EKRAN GÖRÜNTÜLERİ
#
# ÖNEMLİ: Play telefon ekran görüntülerinde en boy oranının 16:9 ile 9:16
# ARASINDA olmasını istiyor (yani en dar 0.5625). Modern telefonlar
# genelde 20:9 (~0.46) çekiyor — bu oran Play tarafından REDDEDİLİR.
# Bu yüzden görüntüyü kırpmak yerine, kenarlara uygulamanın zemin
# renginde bant ekleyip orana getiriyoruz. İçerik kaybolmuyor.
# ---------------------------------------------------------------------------
function Duzenle-EkranGoruntuleri {
    if (-not (Test-Path $hamKlas)) {
        New-Item -ItemType Directory -Force $hamKlas | Out-Null
        Yaz "  --  Ekran görüntüsü yok. Telefondan aldıklarını şuraya at:"
        Yaz "      $hamKlas"
        return
    }

    $dosyalar = Get-ChildItem $hamKlas -Include *.png,*.jpg,*.jpeg -File -Recurse
    if ($dosyalar.Count -eq 0) {
        Yaz "  --  $hamKlas boş. Telefon ekran görüntülerini oraya at."
        return
    }

    $MIN_ORAN = 9.0 / 16.0   # 0.5625 — Play'in izin verdiği en dar oran
    $MAX_ORAN = 16.0 / 9.0
    $sayac = 0

    foreach ($d in $dosyalar) {
        $src = [System.Drawing.Image]::FromFile($d.FullName)
        try {
            $g = $src.Width; $y = $src.Height
            $oran = $g / $y

            $hedefG = $g; $hedefY = $y
            if ($oran -lt $MIN_ORAN) { $hedefG = [int][Math]::Ceiling($y * $MIN_ORAN) }  # çok dar -> yana bant
            elseif ($oran -gt $MAX_ORAN) { $hedefY = [int][Math]::Ceiling($g / $MAX_ORAN) }

            # Play sınırı: her kenar 320-3840 px arası
            if ($hedefG -gt 3840 -or $hedefY -gt 3840) {
                $olcek = 3840.0 / [Math]::Max($hedefG, $hedefY)
                $hedefG = [int]($hedefG * $olcek); $hedefY = [int]($hedefY * $olcek)
                $g = [int]($g * $olcek); $y = [int]($y * $olcek)
            }

            $t = Yeni-Tuval $hedefG $hedefY
            try {
                $t.Graphics.Clear((Renk "#16233B"))   # uygulamanın zemin rengi
                $t.Graphics.DrawImage($src, [int](($hedefG - $g) / 2), [int](($hedefY - $y) / 2), $g, $y)

                $sayac++
                $ad = "ekran-{0:d2}.png" -f $sayac
                $t.Bitmap.Save((Join-Path $ekranKlas $ad), [System.Drawing.Imaging.ImageFormat]::Png)

                $not = if ($oran -lt $MIN_ORAN) { " (orana getirmek için yanlara bant eklendi)" } else { "" }
                Yaz ("  OK  telefon/$ad  {0}x{1} -> {2}x{3}$not" -f $src.Width, $src.Height, $hedefG, $hedefY)

                # --- Tablet kopyaları ---------------------------------------
                # Play, tablet ekran görüntülerini de ZORUNLU tutuyor (formda
                # yıldızlı). Ayrı bir tablet cihazda ekran görüntüsü almak
                # yerine aynı görselleri Play'in boyut kurallarına uyduruyoruz:
                #   7 inç : her kenar 320-3840
                #   10 inç: her kenar 1080-7680
                # Oran kuralı (16:9 - 9:16) yukarıda zaten sağlandı.
                foreach ($tb in @(
                    @{ Ad = "tablet7";  Klasor = $tablet7Klas;  MinKenar = 320  },
                    @{ Ad = "tablet10"; Klasor = $tablet10Klas; MinKenar = 1080 }
                )) {
                    $tg = $hedefG; $ty = $hedefY
                    $enKisa = [Math]::Min($tg, $ty)
                    if ($enKisa -lt $tb.MinKenar) {
                        $olcekTb = $tb.MinKenar / $enKisa
                        $tg = [int][Math]::Ceiling($tg * $olcekTb)
                        $ty = [int][Math]::Ceiling($ty * $olcekTb)
                    }

                    if ($tg -eq $hedefG -and $ty -eq $hedefY) {
                        $t.Bitmap.Save((Join-Path $tb.Klasor $ad), [System.Drawing.Imaging.ImageFormat]::Png)
                    } else {
                        $t2 = Yeni-Tuval $tg $ty
                        try {
                            $t2.Graphics.DrawImage($t.Bitmap, 0, 0, $tg, $ty)
                            $t2.Bitmap.Save((Join-Path $tb.Klasor $ad), [System.Drawing.Imaging.ImageFormat]::Png)
                        } finally { $t2.Graphics.Dispose(); $t2.Bitmap.Dispose() }
                    }
                    Yaz ("      $($tb.Ad)/$ad  {0}x{1}" -f $tg, $ty)
                }
            } finally { $t.Graphics.Dispose(); $t.Bitmap.Dispose() }
        } finally { $src.Dispose() }
    }
}

# ---------------------------------------------------------------------------
Yaz ""
Yaz "Play Console gorselleri uretiliyor..."
Yaz ""
Uret-Simge
Uret-OzellikGrafigi
Duzenle-EkranGoruntuleri
Yaz ""
Yaz "Bitti -> $cikti"
Yaz ""
