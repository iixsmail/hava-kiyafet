# Bağlı Android cihaz/emülatörden mağaza için ekran görüntüsü alır.
#
# Uygulamayı adb ile sürer (dokunma/kaydırma) ve her adımda ekran
# görüntüsünü tools/ham-ekran-goruntuleri/ klasörüne kaydeder.
# Sonrasında play-gorseller.ps1 bunları Play'in istediği boyutlara getirir.
#
# Kullanım:  pwsh -File tools/ekran-goruntusu-al.ps1

$ErrorActionPreference = "Stop"

$adb    = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$paket  = "com.ismail.havakiyafet"
$hedef  = Join-Path $PSScriptRoot "ham-ekran-goruntuleri"
New-Item -ItemType Directory -Force $hedef | Out-Null

function Adb { & $adb @args 2>&1 }

function Bekle([int]$ms) { Start-Sleep -Milliseconds $ms }

function Yakala([string]$ad) {
    $yol = Join-Path $hedef "$ad.png"
    # exec-out: ikili veriyi bozmadan doğrudan dosyaya yazar
    & $adb exec-out screencap -p > $yol
    $boyut = (Get-Item $yol).Length
    Write-Host ("  yakalandi: $ad.png  ({0:n0} bayt)" -f $boyut)
}

function Dokun([int]$x, [int]$y) { Adb shell input tap $x $y | Out-Null; Bekle 700 }
function Kaydir([int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$sure) {
    Adb shell input swipe $x1 $y1 $x2 $y2 $sure | Out-Null; Bekle 900
}

# --- Ekran boyutunu al -----------------------------------------------------
$boyutSatiri = (Adb shell wm size) -join ""
if ($boyutSatiri -match "(\d+)x(\d+)") {
    $G = [int]$Matches[1]; $Y = [int]$Matches[2]
} else { throw "Ekran boyutu okunamadi: $boyutSatiri" }
Write-Host "Ekran: ${G}x${Y}"

# --- Uygulamayı temiz başlat ----------------------------------------------
Write-Host "Uygulama baslatiliyor..."
Adb shell am force-stop $paket | Out-Null
Bekle 600
Adb shell monkey -p $paket -c android.intent.category.LAUNCHER 1 | Out-Null

# Sabit süre beklemek güvenilir değil: soğuk başlangıç emülatörde 6 sn'yi
# aşabiliyor ve dokunuşlar henüz çizilmemiş ekrana gidiyor. Bunun yerine
# ekranda beklenen metin çıkana kadar bekliyoruz.
function EkranHazirBekle([string]$aranan, [int]$saniye = 40) {
    for ($i = 0; $i -lt $saniye; $i++) {
        Bekle 1000
        $dokum = Adb shell uiautomator dump /sdcard/ui.xml 2>&1
        $xml   = (Adb shell cat /sdcard/ui.xml) -join ""
        if ($xml -match [regex]::Escape($aranan)) {
            Write-Host "  hazir: '$aranan' ($($i+1) sn)"
            return $true
        }
    }
    Write-Host "  UYARI: '$aranan' $saniye sn icinde gorunmedi"
    return $false
}

EkranHazirBekle "Şehir ara" | Out-Null

# --- Sehri sabitle ---------------------------------------------------------
# Emulatorun varsayilan konumu "Mountain View, California" olarak geliyor;
# Turkce magaza sayfasinda bu yanlis durur. Uygulamanin kendi arama
# ozelligiyle Ankara'ya geciyoruz (arama ozelligi de calisir halde
# goruntulenmis oluyor).
Write-Host "Sehir Ankara olarak ayarlaniyor..."
Dokun ([int]($G*0.35)) ([int]($Y*0.122))     # arama kutusu
Bekle 800
Adb shell input text "Ankara" | Out-Null
Bekle 600
Dokun ([int]($G*0.88)) ([int]($Y*0.122))     # "Ara" butonu
EkranHazirBekle "Ankara, Ankara" 25 | Out-Null

# NOT: Burada BACK GONDERME. `input text` ekran klavyesini acmadigi icin
# BACK dogrudan uygulamaya gider ve ana ekrandayken uygulamayi KAPATIR.
# Emulatorun yuzen klavye arac cubugunu ESCAPE ile kapatiyoruz.
Adb shell input keyevent 111 | Out-Null
Bekle 1200

# --- 1) Ana ekran ----------------------------------------------------------
Yakala "01-ana-ekran"

# --- 2) Kiyafet onerileri --------------------------------------------------
# Kaydirma miktarlari bilerek kucuk: fazla kaydirinca ekranin altindaki
# REKLAM BANNER'I kadraja giriyor. Magaza gorsellerinde reklam olmamali.
Kaydir ([int]($G*0.5)) ([int]($Y*0.72)) ([int]($G*0.5)) ([int]($Y*0.44)) 600
Yakala "02-kiyafet-onerileri"

# --- 3) Saatlik + 7 gunluk tahmin ------------------------------------------
Kaydir ([int]($G*0.5)) ([int]($Y*0.72)) ([int]($G*0.5)) ([int]($Y*0.46)) 600
Yakala "03-tahminler"
# Alttaki BOS reklam kutusu ve yarim kalan Premium seridi kadrajdan cikar.
# (Kirpma fonksiyonu asagida tanimli oldugu icin cagri sonda yapiliyor.)

# --- 5) Premium ekrani -----------------------------------------------------
# Basa don, sag ustteki "Premium" rozetine dokun
foreach ($i in 1..4) {
    Kaydir ([int]($G*0.5)) ([int]($Y*0.25)) ([int]($G*0.5)) ([int]($Y*0.9)) 350
}
Bekle 1000
Dokun ([int]($G*0.87)) ([int]($Y*0.075))
EkranHazirBekle "Havayı tam olarak bil" 20 | Out-Null
Bekle 800
Yakala "04-premium"

# Premium ekraninin ALT KISMINI kirp.
# Sebep: orada "Bu ortamda satin alma kullanilamiyor" uyarisi var. Bu,
# emulatorde Play Billing bulunmadigi icin cikan bir ORTAM mesaji; Play'den
# kurulan gercek surumde gorunmez. Magaza gorselinde birakmak yaniltici olur.
function KirpAlt([string]$dosya, [double]$oran) {
    Add-Type -AssemblyName System.Drawing
    $yol = Join-Path $hedef $dosya
    $src = [System.Drawing.Image]::FromFile($yol)
    try {
        $yeniY = [int]($src.Height * $oran)
        $bmp = New-Object System.Drawing.Bitmap($src.Width, $yeniY)
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.DrawImage($src, 0, 0, $src.Width, $src.Height)
        $gfx.Dispose()
        $src.Dispose()
        $bmp.Save($yol, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host ("  kirpildi: $dosya -> {0}x{1} (ortam uyarisi cikarildi)" -f $bmp.Width, $yeniY)
    } catch { $src.Dispose(); throw }
}
KirpAlt "03-tahminler.png" 0.83
KirpAlt "04-premium.png" 0.74

# Ana ekrana geri don
Adb shell input keyevent KEYCODE_BACK | Out-Null
Bekle 800

Write-Host ""
Write-Host "Bitti. Goruntuler: $hedef"
Write-Host "Simdi calistir:  pwsh -File tools/play-gorseller.ps1"
