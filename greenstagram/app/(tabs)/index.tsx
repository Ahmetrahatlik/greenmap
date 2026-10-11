
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
// Bedava ve Key İstemeyen WebView Motoru
import { WebView } from 'react-native-webview';

// FİREBASE BAĞLANTILARI (Seninkilerle birebir aynı)
import { addDoc, collection, doc, getDoc, increment, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function MapScreen() {
  const user = auth.currentUser;
  
  const [noktalar, setNoktalar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenNokta, setSecilenNokta] = useState<any>(null);
  const [bagisMiktari, setBagisMiktari] = useState<string>('1');

  const [kullaniciRol, setKullaniciRol] = useState('kullanici');
  const [adminModalAcik, setAdminModalAcik] = useState(false);
  const [yeniNoktaAd, setYeniNoktaAd] = useState('');
  const [yeniEnlem, setYeniEnlem] = useState('');
  const [yeniBoylam, setYeniBoylam] = useState('');
  const [yeniHedef, setYeniHedef] = useState('');

  useEffect(() => {
    const unsubscribeNoktalar = onSnapshot(collection(db, 'isaretler'), (snapshot) => {
      const haritaVerileri = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNoktalar(haritaVerileri);
      
      if (secilenNokta) {
        const guncelNokta = haritaVerileri.find(n => n.id === secilenNokta.id);
        if (guncelNokta) setSecilenNokta(guncelNokta);
      }
      setYukleniyor(false);
    });

    if (user) {
      const unsubscribeRol = onSnapshot(doc(db, 'kullanicilar', user.uid), (docSnap) => {
        if (docSnap.exists()) setKullaniciRol(docSnap.data().rol || 'kullanici');
      });
      return () => { unsubscribeNoktalar(); unsubscribeRol(); };
    }

    return () => unsubscribeNoktalar();
  }, [user, secilenNokta?.id]);

  // FİDAN BAĞIŞLA (Orijinal efsane mantık - Dokunmadım)
  const fidanBagisla = async () => {
    const miktar = parseInt(bagisMiktari);
    if (!user || !secilenNokta) return;
    if (isNaN(miktar) || miktar <= 0) { Alert.alert("Hata", "Lütfen geçerli bir fidan adedi girin."); return; }

    try {
      const userRef = doc(db, 'kullanicilar', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const mevcutFidanlar = userData?.fidanSayisi || 0;

      if (mevcutFidanlar < miktar) { Alert.alert("Yetersiz Fidan!", `Cüzdanınızda sadece ${mevcutFidanlar} fidan var. 🌱`); return; }

      await updateDoc(userRef, { fidanSayisi: increment(-miktar), puan: increment(miktar * 5), toplamBagis: increment(miktar) });

      const ormanRef = doc(db, 'isaretler', secilenNokta.id);
      const benimMevcutBagisim = secilenNokta.katilimcilar?.[user.uid]?.fidanSayisi || 0;
      const yeniKisiselToplam = benimMevcutBagisim + miktar;

      const guncellemeler: any = {
        toplananFidan: increment(miktar),
        [`katilimcilar.${user.uid}`]: { ad: userData?.kullaniciAdi || 'Anonim', fidanSayisi: yeniKisiselToplam }
      };

      if (yeniKisiselToplam > (secilenNokta.liderFidan || 0)) {
        guncellemeler.liderID = user.uid;
        guncellemeler.liderAd = userData?.kullaniciAdi || 'Anonim';
        guncellemeler.liderFidan = yeniKisiselToplam;
        Alert.alert("Tebrikler! 👑", "Yarışta öne geçtin!");
      } else {
        Alert.alert("Tebrikler!", `${secilenNokta.ad} mevkisine ${miktar} fidan can suyu oldu!`);
      }

      await updateDoc(ormanRef, guncellemeler);
      setBagisMiktari('1');
    } catch (error) { Alert.alert("Hata", "Bağış işlemi başarısız."); }
  };
// YENİ NOKTAYI HARİTAYA VE FİREBASE'E ÇAKMA FONKSİYONU
  const haritayaNoktaEkle = async () => {
    // Alanlar boş mu diye kontrol et
    if (!yeniNoktaAd.trim() || !yeniEnlem || !yeniBoylam || !yeniHedef) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun usta!");
      return;
    }

    // Sayıları güvenli şekilde çevir
    const enlemNum = parseFloat(yeniEnlem);
    const boylamNum = parseFloat(yeniBoylam);
    const hedefNum = parseInt(yeniHedef);

    if (isNaN(enlemNum) || isNaN(boylamNum) || isNaN(hedefNum)) {
      Alert.alert("Hata", "Enlem, Boylam ve Hedef kısımlarına sadece rakam girin!");
      return;
    }

    try {
      // Firebase 'isaretler' (veya senin koleksiyon adın neyse) tablosuna ekle
      await addDoc(collection(db, 'isaretler'), {
        ad: yeniNoktaAd,
        enlem: enlemNum,
        boylam: boylamNum,
        hedefFidan: hedefNum,
        toplananFidan: 0,
        katilimcilar: {},
        tarih: serverTimestamp() // Bunun çalışması için yukarıdan import etmeyi unutma (2. adıma bak)
      });

      // Başarılı olursa modali kapat ve kutuları temizle
      Alert.alert("Başarılı! 📍", "Yeni orman alanı haritaya dikildi!");
      setAdminModalAcik(false);
      setYeniNoktaAd(''); setYeniEnlem(''); setYeniBoylam(''); setYeniHedef('');
      
    } catch (error: any) {
      Alert.alert("Hata", "Nokta eklenemedi: " + error.message);
    }
  };
  // BEDAVA HARİTA İÇİN HTML MOTORU (Noktaları Dinamik ve RENKLİ Gördük)
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; } #map { height: 100vh; }
        /* KRİTİK GÜNCELLEME: Pin renklerini CSS ile değiştiriyoruz */
        /* Ağaçlandırma Alanı (Kırmızımsı/Turuncu) */
        .planting-marker { filter: hue-rotate(130deg); }
        /* Tamamlanmış Orman (Yeşil) */
        .forest-marker { filter: hue-rotate(280deg) saturate(2); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
      // Dünyanın en uç sınırlarını belirliyoruz
var dunyaSinirlari = [[-90, -180], [90, 180]];

var map = L.map('map', {
    maxBounds: dunyaSinirlari, // Haritayı bu sınırlara hapseder
    maxBoundsViscosity: 1.0,   // Sınıra çarpınca lastik gibi sekmesini engeller, beton duvar etkisi yapar
    minZoom: 3                 // Kullanıcının uzaya kadar zoom out yapmasını (geri çıkmasını) engeller
}).setView([37.8714, 32.4846], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true // Dünyanın yan yana sonsuza kadar kopyalanmasını kapatır
}).addTo(map);
        
        // Senin Firebase'den gelen noktalarını buraya yolluyoruz
        const data = ${JSON.stringify(noktalar)};
        data.forEach(n => {
          // KRİTİK GÜNCELLEME: Hedefe göre class seçiyoruz
          const hedefDoldu = n.toplananFidan >= n.hedefFidan;
          const markerClass = hedefDoldu ? 'forest-marker' : 'planting-marker';
          
          var customIcon = L.icon({
              iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              className: markerClass // Rengi burası belirler
          });

          var marker = L.marker([n.enlem, n.boylam], {icon: customIcon}).addTo(map);
          marker.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify(n));
          });
        });
      </script>
    </body>
    </html>
  `;

  if (yukleniyor) return <View style={styles.merkez}><ActivityIndicator size="large" color="#2e8b57" /></View>;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        
        {/* HARİTA KISMI: Artık key istemeyen WebView ile çalışıyor */}
        <View style={styles.map}>
          <WebView 
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            onMessage={(event) => {
              const nokta = JSON.parse(event.nativeEvent.data);
              setSecilenNokta(nokta);
            }}
          />
        </View>

        {/* ÜST PANEL (Orijinal tasarımın) */}
        <View style={styles.ustPanelKapsayici}>
          <View style={styles.ustPanel}><Text style={styles.ustPanelYazi}>Greenstagram Harita</Text></View>
          {kullaniciRol === 'admin' && (
            <TouchableOpacity style={styles.adminEkleButon} onPress={() => setAdminModalAcik(true)}>
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* ALT KART (Orijinal detaylı bağış ekranı - Birebir aynı duruyor) */}
        {secilenNokta && (
          <View style={styles.altKart}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 10}}>
                <View style={styles.kartUst}>
                  <Text style={styles.kartBaslik}>{secilenNokta.ad}</Text>
                  <TouchableOpacity onPress={() => setSecilenNokta(null)}><Ionicons name="close-circle" size={28} color="#ccc" /></TouchableOpacity>
                </View>

                <View style={styles.istatistikSatiri}>
                  <View style={styles.istatistikItem}><Text style={styles.istatistikSayi}>{secilenNokta.hedefFidan}</Text><Text style={styles.istatistikEtiket}>Hedef</Text></View>
                  <View style={styles.istatistikItem}><Text style={[styles.istatistikSayi, secilenNokta.toplananFidan >= secilenNokta.hedefFidan && {color: '#ffa000'}]}>{secilenNokta.toplananFidan}</Text><Text style={styles.istatistikEtiket}>Toplanan</Text></View>
                </View>

                <View style={styles.liderlikKutusu}>
                    <Text style={styles.liderlikBaslik}>👑 Mevcut Lider</Text>
                    <Text style={styles.liderlikIsim}>
                        {secilenNokta.liderAd ? `@${secilenNokta.liderAd}` : 'Henüz Lider Yok'} 
                        {secilenNokta.liderFidan ? ` (${secilenNokta.liderFidan} Fidan)` : ''}
                    </Text>
                </View>

                {secilenNokta.toplananFidan < secilenNokta.hedefFidan && (
                    <View>
                        <View style={styles.miktarSecici}>
                          <Text style={styles.miktarEtiket}>Adet:</Text>
                          <View style={styles.sayacKutusu}>
                              <TouchableOpacity onPress={() => setBagisMiktari(Math.max(1, parseInt(bagisMiktari || '0') - 1).toString())} style={styles.sayacButon}>
                                  <Ionicons name="remove" size={20} color="#2e8b57" />
                              </TouchableOpacity>
                              <TextInput style={styles.sayacInput} keyboardType="numeric" value={bagisMiktari} onChangeText={setBagisMiktari} selectTextOnFocus />
                              <TouchableOpacity onPress={() => setBagisMiktari((parseInt(bagisMiktari || '0') + 1).toString())} style={styles.sayacButon}>
                                  <Ionicons name="add" size={20} color="#2e8b57" />
                              </TouchableOpacity>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.bagisButon} onPress={fidanBagisla}>
                          <Text style={styles.bagisYazi}>{bagisMiktari} Fidan Bağışla</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ADMIN MODAL (Orijinal admin paneli - Dokunmadım) */}
      <Modal visible={adminModalAcik} animationType="slide" transparent>
          <View style={styles.modalArkaPlan}>
            <View style={styles.modalKutu}>
              <Text style={styles.modalBaslik}>📍 Yeni Nokta Ekle</Text>
              <TextInput style={styles.input} placeholder="Nokta Adı" value={yeniNoktaAd} onChangeText={setYeniNoktaAd} />
              <TextInput style={styles.input} placeholder="Enlem (Örn: 37.8)" value={yeniEnlem} onChangeText={setYeniEnlem} />
              <TextInput style={styles.input} placeholder="Boylam (Örn: 32.4)" value={yeniBoylam} onChangeText={setYeniBoylam} />
              <TextInput style={styles.input} placeholder="Hedef Fidan" value={yeniHedef} onChangeText={setYeniHedef} />
              <TouchableOpacity style={styles.kaydetButon} onPress={haritayaNoktaEkle}>
                <Text style={styles.kaydetYazi}>Haritaya Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAdminModalAcik(false)} style={{marginTop: 10}}><Text style={{color: 'red', textAlign: 'center'}}>Kapat</Text></TouchableOpacity>
            </View>
          </View>
      </Modal>
    </View>
  );
}

// STİLLERİN (Seninkileri birebir korudum, hiç yemedim!)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  map: { flex: 1 },
  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ustPanelKapsayici: { position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  ustPanel: { backgroundColor: 'rgba(46, 139, 87, 0.9)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25 },
  ustPanelYazi: { color: 'white', fontWeight: 'bold' },
  adminEkleButon: { backgroundColor: '#1b5e20', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  altKart: { position: 'absolute', bottom: 30, left: 15, right: 15, backgroundColor: 'white', borderRadius: 30, padding: 25, elevation: 20, maxHeight: '60%' },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  kartBaslik: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  istatistikSatiri: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, backgroundColor: '#f1f8e9', padding: 15, borderRadius: 20 },
  istatistikItem: { alignItems: 'center' },
  istatistikSayi: { fontSize: 20, fontWeight: 'bold', color: '#2e8b57' },
  istatistikEtiket: { fontSize: 12, color: '#666' },
  liderlikKutusu: { alignItems: 'center', marginBottom: 15, paddingVertical: 10, backgroundColor: '#fff9e6', borderRadius: 15 },
  liderlikBaslik: { fontSize: 14, fontWeight: 'bold', color: '#f57f17' },
  liderlikIsim: { fontSize: 16, fontWeight: 'bold' },
  miktarSecici: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  miktarEtiket: { fontSize: 17, fontWeight: 'bold' },
  sayacKutusu: { flexDirection: 'row', alignItems: 'center' },
  sayacButon: { backgroundColor: '#e8f5e9', width: 35, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sayacInput: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 15, textAlign: 'center' },
  bagisButon: { backgroundColor: '#2e8b57', padding: 18, borderRadius: 20, alignItems: 'center' },
  bagisYazi: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  modalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalKutu: { backgroundColor: 'white', width: '85%', borderRadius: 25, padding: 25 },
  modalBaslik: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 10 },
  kaydetButon: { backgroundColor: '#1b5e20', padding: 15, borderRadius: 15, alignItems: 'center' },
  kaydetYazi: { color: 'white', fontWeight: 'bold' }
});