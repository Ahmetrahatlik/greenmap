import { Ionicons } from '@expo/vector-icons';
import { doc, increment, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function ShopScreen() {
  const user = auth.currentUser;
  const [puan, setPuan] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [seciliRenkler, setSeciliRenkler] = useState<{[key: number]: string}>({
    1: 'Doğal Yeşil',
    2: 'Doğal Yeşil'
  });

  const [kargoModalAcik, setKargoModalAcik] = useState(false);
  const [islemdekiUrun, setIslemdekiUrun] = useState<any>(null);
  const [kargoAdres, setKargoAdres] = useState('');
  const [kargoIlIlce, setKargoIlIlce] = useState('');
  const [kargoTel, setKargoTel] = useState('');
  const [satinAlmaIslemde, setSatinAlmaIslemde] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'kullanicilar', user.uid), (docSnap) => {
      if (docSnap.exists()) setPuan(docSnap.data().puan || 0);
      setYukleniyor(false);
    });
    return () => unsubscribe();
  }, [user]);

  const renkDegistir = (urunId: number, renk: string) => {
    setSeciliRenkler(prev => ({ ...prev, [urunId]: renk }));
  };

  const satinAlmayiBaslat = (urun: any) => {
    if (puan < urun.fiyat) {
      Alert.alert("Yetersiz Puan", `Bu ürünü almak için ${urun.fiyat - puan} puana daha ihtiyacın var! 🌱`);
      return;
    }

    if (urun.tip === 'fiziksel') {
      setIslemdekiUrun(urun);
      setKargoModalAcik(true);
    } else {
      Alert.alert(
        "Satın Alım Onayı",
        `${urun.fiyat} Puan karşılığında '${urun.ad}' almak üzeresin.`,
        [
          { text: "Vazgeç", style: "cancel" },
          { 
            text: "Onayla", 
            onPress: async () => {
              try {
                await updateDoc(doc(db, 'kullanicilar', user!.uid), { 
                    puan: increment(-urun.fiyat),
                    isimDegistirmeHakki: increment(1) 
                });
                Alert.alert("Harika! 🎉", "İsim değiştirme hakkın hesabına tanımlandı. Profilinden kullanabilirsin.");
              } catch (error) { Alert.alert("Hata", "İşlem başarısız."); }
            }
          }
        ]
      );
    }
  };

  const fizikselUrunSiparisiTamamla = async () => {
    if (!kargoAdres || !kargoIlIlce || !kargoTel) {
        Alert.alert("Eksik Bilgi", "Lütfen kargo teslimatı için tüm alanları doldurun.");
        return;
    }
    setSatinAlmaIslemde(true);
    try {
        await updateDoc(doc(db, 'kullanicilar', user!.uid), { puan: increment(-islemdekiUrun.fiyat) });
        setSatinAlmaIslemde(false);
        setKargoModalAcik(false);
        setKargoAdres(''); setKargoIlIlce(''); setKargoTel(''); setIslemdekiUrun(null);
        Alert.alert("Sipariş Alındı! 🎁", "Hediyen en kısa sürede adresine kargolanacak.");
    } catch (e) {
        setSatinAlmaIslemde(false);
        Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
    }
  };

  // İNTERNET LİNKLERİ İLE HİÇBİR ZAMAN ÇÖKMEYEN VE ALAKASIZ ÇIKMAYAN ÜRÜNLER LİSTESİ
 const urunler = [
  { 
    id: 1, 
    ad: "Bez Çanta", 
    fiyat: 500, 
    tip: "fiziksel",
    resimler: {
      'Doğal Yeşil': require('../../assets/images/y_c.jpeg'), // Yeşil Çanta
      'Toprak Kahvesi': require('../../assets/images/k_c.jpeg'), // Kahverengi Çanta
      'Okyanus Mavisi': require('../../assets/images/m_c.jpeg') // Mavi Çanta
    }
  },
  { 
    id: 2, 
    ad: "Mini Bahçe Seti", 
    fiyat: 2500, 
    tip: "fiziksel",
    resimler: {
      'Doğal Yeşil': require('../../assets/images/y_b.jpeg'), // Yeşil Bahçe Seti
      'Toprak Kahvesi': require('../../assets/images/k_b.jpeg'), // Kahverengi Bahçe Seti
      'Okyanus Mavisi': require('../../assets/images/m_b.jpeg') // Mavi Bahçe Seti
    }
  },
    { 
      id: 3, ad: "Kullanıcı İsmi Değiştirme", fiyat: 5000, tip: "dijital",
      resimler: {
        'Standart': "https://static.wikia.nocookie.net/minecraft_gamepedia/images/f/f1/Name_Tag_JE2_BE2.png" 
      },
      aciklama: "Nickini beğenmedin mi? Bu eşya ile kullanıcı adını 1 kez değiştirme hakkı kazanırsın."
    }
  ];

  const renkListesi = ['Doğal Yeşil', 'Toprak Kahvesi', 'Okyanus Mavisi'];

  if (yukleniyor) return <ActivityIndicator style={{flex:1, justifyContent: 'center'}} color="#2e8b57" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerBaslik}>Doğa Mağazası</Text>
        <View style={styles.puanKapsul}>
          <Ionicons name="star" size={16} color="#f57f17" />
          <Text style={styles.puanYazi}>{puan} Puan</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.icerik}>
        <Text style={styles.altBaslik}>Ödüllerini Seç</Text>

       {urunler.map((urun) => {
  const gosterilecekResim = urun.tip === 'fiziksel' 
    ? urun.resimler[seciliRenkler[urun.id] as keyof typeof urun.resimler] 
    : urun.resimler['Standart'];

  // Resim bir internet linki mi (string) yoksa yerel dosya mı (number) kontrolü
  const resimKaynagi = typeof gosterilecekResim === 'string' 
    ? { uri: gosterilecekResim } 
    : gosterilecekResim;

  return (
    <View key={urun.id} style={styles.urunKart}>
      <View style={styles.resimKapsayici}>
         <Image 
           source={resimKaynagi} // Artık akıllı bir şekilde kaynağı seçiyor
           style={styles.urunGorsel} 
           resizeMode="cover"/>
              </View>
              
              <View style={styles.urunDetay}>
                <View style={styles.urunBaslikSatiri}>
                  <Text style={styles.urunAd}>{urun.ad}</Text>
                  <Text style={styles.urunFiyat}>{urun.fiyat} Puan</Text>
                </View>

                {urun.tip === 'fiziksel' ? (
                  <View>
                    <Text style={styles.renkSecimBaslik}>Renk Seçimi:</Text>
                    <View style={styles.renkSecici}>
                      {renkListesi.map((renk) => {
                        const seciliMi = seciliRenkler[urun.id] === renk;
                        return (
                          <TouchableOpacity 
                            key={renk} 
                            style={[styles.renkButon, seciliMi && styles.seciliRenkButon]}
                            onPress={() => renkDegistir(urun.id, renk)}
                          >
                            <Text style={[styles.renkYazi, seciliMi && {color: 'white'}]}>{renk}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.dijitalAciklama}>{urun.aciklama}</Text>
                )}

                <TouchableOpacity style={styles.alButon} onPress={() => satinAlmayiBaslat(urun)}>
                  <Ionicons name={urun.tip === 'fiziksel' ? "cart" : "refresh"} size={20} color="white" style={{marginRight: 8}} />
                  <Text style={styles.alButonYazi}>Satın Al</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* KARGO MODALI */}
      <Modal visible={kargoModalAcik} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kargoModalArkaPlan}>
          <View style={styles.kargoModalKutu}>
            <View style={styles.kargoModalUstBar}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="cube" size={24} color="#2e8b57" />
                    <Text style={styles.kargoModalBaslik}> Kargo Bilgileri</Text>
                </View>
                <TouchableOpacity onPress={() => setKargoModalAcik(false)}><Ionicons name="close-circle" size={32} color="#ccc" /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.kargoOzetKutu}>
                    <Text style={{color: '#666', fontWeight: 'bold'}}>Seçilen Ürün:</Text>
                    <Text style={{fontSize: 16, color: '#1b5e20', fontWeight: 'bold', marginTop: 4}}>
                        {islemdekiUrun?.ad} ({seciliRenkler[islemdekiUrun?.id]})
                    </Text>
                </View>
                <Text style={styles.inputEtiket}>İl / İlçe</Text>
                <TextInput style={styles.kargoInput} placeholder="Örn: Kadıköy / İstanbul" value={kargoIlIlce} onChangeText={setKargoIlIlce} />
                <Text style={styles.inputEtiket}>Telefon Numarası</Text>
                <TextInput style={styles.kargoInput} placeholder="05XX XXX XX XX" keyboardType="numeric" value={kargoTel} onChangeText={setKargoTel} />
                <Text style={styles.inputEtiket}>Açık Adres</Text>
                <TextInput style={[styles.kargoInput, {height: 80}]} placeholder="Mahalle, Sokak, Bina No..." multiline value={kargoAdres} onChangeText={setKargoAdres} />
                <TouchableOpacity style={[styles.kargoOnayButon, satinAlmaIslemde && {backgroundColor: '#a5d6a7'}]} onPress={fizikselUrunSiparisiTamamla} disabled={satinAlmaIslemde}>
                    {satinAlmaIslemde ? <ActivityIndicator color="white" /> : <Text style={styles.kargoOnayYazi}>{islemdekiUrun?.fiyat} Puan Öde ve Sipariş Ver</Text>}
                </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fbf9' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee', elevation: 2 },
  headerBaslik: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  puanKapsul: { backgroundColor: '#fff9e6', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#ffe082' },
  puanYazi: { fontWeight: 'bold', color: '#f57f17', marginLeft: 5, fontSize: 15 },
  icerik: { padding: 20, paddingBottom: 50 },
  altBaslik: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 15 },
  urunKart: { backgroundColor: 'white', borderRadius: 20, marginBottom: 25, elevation: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  // resimKapsayici içindeki padding silindi, tam otursun diye
  resimKapsayici: { width: '100%', height: 220, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  urunGorsel: { width: '100%', height: '100%' },
  urunDetay: { padding: 20 },
  urunBaslikSatiri: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  urunAd: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  urunFiyat: { fontSize: 16, color: '#f57f17', fontWeight: 'bold' },
  renkSecimBaslik: { fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 'bold' },
  renkSecici: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  renkButon: { paddingVertical: 10, paddingHorizontal: 5, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', flex: 1, marginHorizontal: 3, alignItems: 'center', backgroundColor: '#fafafa' },
  seciliRenkButon: { backgroundColor: '#2e8b57', borderColor: '#2e8b57' },
  renkYazi: { fontSize: 11, color: '#666', fontWeight: 'bold', textAlign: 'center' },
  dijitalAciklama: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 20, lineHeight: 20 },
  alButon: { backgroundColor: '#2e8b57', paddingVertical: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  alButonYazi: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  kargoModalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  kargoModalKutu: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, height: '80%' },
  kargoModalUstBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  kargoModalBaslik: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  kargoOzetKutu: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#c8e6c9' },
  inputEtiket: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 5, marginLeft: 5 },
  kargoInput: { backgroundColor: '#f9fbf9', borderWidth: 1, borderColor: '#ddd', borderRadius: 15, padding: 15, marginBottom: 15, fontSize: 15, color: '#333' },
  kargoOnayButon: { backgroundColor: '#f57f17', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 10, elevation: 3 },
  kargoOnayYazi: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});