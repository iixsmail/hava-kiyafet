import React from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Ekran arka planındaki dikey renk geçişi.
//
// Önceden bu, ekranı 48 düz yatay şeride bölen saf JS bir taklitti. Gerekçesi
// "native modül eklersek eldeki APK geçersiz kalır" idi; artık her sürümü
// kaynaktan prebuild + rebuild ile ürettiğimiz için o gerekçe geçersiz.
//
// 48 şerit 2400 piksellik bir ekranda şerit başına ~50 piksel demekti ve
// geçişler gözle görülür bantlar hâlinde çıkıyordu — kullanıcının "arka plan
// piksel piksel duruyor" dediği şey buydu. LinearGradient donanımda
// enterpolasyon yapıyor, bant kalmıyor.

export default function GradientBackground({ colors }) {
  // Tek renk gelirse LinearGradient en az iki durak istiyor.
  const duraklar =
    !colors || colors.length === 0
      ? ["#16233B", "#16233B"]
      : colors.length === 1
        ? [colors[0], colors[0]]
        : colors;

  return (
    <LinearGradient
      colors={duraklar}
      style={StyleSheet.absoluteFill}
      // Dikey geçiş: hava temaları yukarıdan aşağı koyulaşacak şekilde
      // tasarlandı (kontrast denetimi bu yöne göre yapıldı).
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      pointerEvents="none"
    />
  );
}
