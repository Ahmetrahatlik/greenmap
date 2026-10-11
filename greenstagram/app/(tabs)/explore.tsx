import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function ExploreScreen() {
  const user = auth.currentUser;
  const router = useRouter();
  
  const [mesajlar, setMesajlar] = useState<any[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kullaniciBilgisi, setKullaniciBilgisi] = useState<any>(null);
  
  const [secilenResim, setSecilenResim] = useState<string | null>(null);
  const [resimYukleniyor, setResimYukleniyor] = useState(false);
  const [oneriModu, setOneriModu] = useState(false);
  const [haritaModalAcik, setHaritaModalAcik] = useState(false);
  const [geciciKonum, setGeciciKonum] = useState({ lat: 37.8714, lng: 32.4846 }); 
  const [kesinKonum, setKesinKonum] = useState<any>(null);
  const [konumGosterModalAcik, setKonumGosterModalAcik] = useState(false);
  const [gosterilecekKonum, setGosterilecekKonum] = useState<any>(null);
  const [aktifFiltre, setAktifFiltre] = useState('yeni');

  const [yorumModalAcik, setYorumModalAcik] = useState(false);
  const [aktifPostId, setAktifPostId] = useState<string | null>(null);
  const [yeniYorum, setYeniYorum] = useState('');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setGeciciKonum({ lat: location.coords.latitude, lng: location.coords.longitude });
      }
    })();

    if (user) {
      const unsubscribeUser = onSnapshot(doc(db, 'kullanicilar', user.uid), (docSnap) => {
        if (docSnap.exists()) setKullaniciBilgisi(docSnap.data());
      });

      const q = query(collection(db, 'topluluk'), orderBy('tarih', 'desc'), limit(30));
      const unsubscribePosts = onSnapshot(q, (snapshot) => {
        const postlar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMesajlar(postlar);
        setYukleniyor(false);
      });

      return () => { unsubscribeUser(); unsubscribePosts(); };
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); }, 1200);
  };

  const getMadalya = (toplam: number) => {
    if (toplam >= 10000) return { ad: "Kral", renk: "#00bcd4", ikon: "diamond" };
    if (toplam >= 1000) return { ad: "Altın", renk: "#ffd700", ikon: "trophy" };
    if (toplam >= 100) return { ad: "Gümüş", renk: "#c0c0c0", ikon: "leaf" };
    if (toplam >= 10) return { ad: "Bronz", renk: "#cd7f32", ikon: "medal" };
    return { ad: "Çaylak", renk: "#888", ikon: "leaf-outline" };
  };

  const gosterilecekMesajlar = [...mesajlar]
    .filter(m => { if (aktifFiltre === 'yardim') return m.tip === 'oneri'; return true; })
    .sort((a, b) => { if (aktifFiltre === 'populer') return (b.begeniSayisi || 0) - (a.begeniSayisi || 0); return 0; });
    
    if (aktifFiltre !== 'yardim') {
      gosterilecekMesajlar.unshift({
          id: 'reklam_sponsor_1', kullaniciId: 'sponsor_marka', yazarAd: 'Doğa Koruma Vakfı', profilFoto: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=200', yazarToplamBagis: 99999, 
          metin: 'Sen de doğaya bir nefes ol! 🌲 Keşfetmeye devam etmeden önce Doğa Mağazasına göz atmayı unutma. Bu hafta sonuna özel tüm fidan paketlerinde büyük indirim var! 👇',
          eklenenResim: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', tip: 'normal', begeniSayisi: 15420, begenenler: [], yorumlar: [], isSponsor: true 
      });
  }

  const fotoSec = async () => {
    let sonuc = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5 });
    if (!sonuc.canceled) setSecilenResim(sonuc.assets[0].uri);
  };

  const haritaSeciminiAc = () => {
    if (kullaniciBilgisi?.rol === 'admin') return setHaritaModalAcik(true);
    if (kullaniciBilgisi?.sonOneriTarihi) {
      const sonOneri = kullaniciBilgisi.sonOneriTarihi.toDate();
      const farkGun = (new Date().getTime() - sonOneri.getTime()) / (1000 * 60 * 60 * 24);
      if (farkGun < 7) return Alert.alert("Spam 🛑", `Haftada 1 öneri yapabilirsin. ${Math.ceil(7 - farkGun)} gün bekle.`);
    }
    setHaritaModalAcik(true);
  };

  const konumSeciminiOnayla = () => { 
    setKesinKonum(geciciKonum); 
    setOneriModu(true);
    setHaritaModalAcik(false); 
  };
  
  const oneriIptal = () => { setOneriModu(false); setKesinKonum(null); };
  const gonderimKapali = oneriModu ? (!yeniMesaj.trim() || !secilenResim || !kesinKonum) : (!yeniMesaj.trim() && !secilenResim);

  const mesajGonder = async () => {
    if (gonderimKapali || !user) return;
    setResimYukleniyor(true);

    try {
      let yuklenenResimUrl = null;

      if (secilenResim) {
        const localUri = secilenResim;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        const formData = new FormData();
        formData.append('image', {
          uri: localUri,
          name: filename,
          type: type,
        } as any);

        const imgbbApiKey = '8e2f7408c81b77bd7bb7e2e70cc41419'; 
        
        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const imgbbData = await imgbbResponse.json();
        
        if(imgbbData.success) {
           yuklenenResimUrl = imgbbData.data.url;
        } else {
           throw new Error("Resim buluta yüklenemedi usta!");
        }
      }

      await addDoc(collection(db, 'topluluk'), {
        kullaniciId: user.uid, yazarAd: kullaniciBilgisi?.kullaniciAdi || 'Doğa Dostu', profilFoto: kullaniciBilgisi?.profilFoto || '...',
        yazarToplamBagis: kullaniciBilgisi?.toplamBagis || 0,
        metin: yeniMesaj.trim(), eklenenResim: yuklenenResimUrl, tip: oneriModu ? 'oneri' : 'normal', 
        enlem: oneriModu && kesinKonum ? kesinKonum.lat : null, 
        boylam: oneriModu && kesinKonum ? kesinKonum.lng : null,
        begeniSayisi: 0, begenenler: [], yorumlar: [], tarih: serverTimestamp() 
      });
      
      const kazanilanPuan = oneriModu ? 200 : 50;
      
      const guncellenecekVeri: any = { puan: increment(kazanilanPuan) };
      
      if (oneriModu) {
          guncellenecekVeri.sonOneriTarihi = serverTimestamp();
      }
      
      await updateDoc(doc(db, 'kullanicilar', user.uid), guncellenecekVeri);
      
      Alert.alert("Tebrikler! 🌿", `Paylaşımın sana +${kazanilanPuan} Puan kazandırdı!`);

      setResimYukleniyor(false);
      setYeniMesaj(''); setSecilenResim(null); setOneriModu(false); setKesinKonum(null); setAktifFiltre('yeni');
    } catch (error: any) { 
        setResimYukleniyor(false);
        Alert.alert("Hata", "Gönderilemedi: " + error.message); 
    }
  };

  const begeniyiTetikle = async (item: any) => {
    if (!user || item.isSponsor) return;
    const postRef = doc(db, 'topluluk', item.id);
    const yazarRef = doc(db, 'kullanicilar', item.kullaniciId); 
    const zatenBegendi = item.begenenler?.includes(user.uid);
    try {
      if (zatenBegendi) { 
          await updateDoc(postRef, { begeniSayisi: increment(-1), begenenler: arrayRemove(user.uid) }); 
          await updateDoc(yazarRef, { puan: increment(-10) }); 
      } else { 
          await updateDoc(postRef, { begeniSayisi: increment(1), begenenler: arrayUnion(user.uid) }); 
          await updateDoc(yazarRef, { puan: increment(10) }); 
      }
    } catch (error) { }
  };

  const yorumGonder = async () => {
    if (!yeniYorum.trim() || !aktifPostId || !user) return;
    try {
      const postIcin = gosterilecekMesajlar.find(m => m.id === aktifPostId);
      const yeniYorumObj = {
          id: Date.now().toString(),
          kullaniciId: user.uid,
          kullaniciAd: kullaniciBilgisi?.kullaniciAdi || 'Üye',
          profilFoto: kullaniciBilgisi?.profilFoto || '',
          metin: yeniYorum.trim()
      };

      await updateDoc(doc(db, 'topluluk', aktifPostId), { yorumlar: arrayUnion(yeniYorumObj) });
      if (postIcin && postIcin.kullaniciId !== user.uid) {
          await updateDoc(doc(db, 'kullanicilar', postIcin.kullaniciId), { puan: increment(5) }); 
      }
      setYeniYorum('');
    } catch (e) { Alert.alert("Hata", "Yorum gönderilemedi."); }
  };

  const yorumYonetimi = (yorum: any, post: any) => {
    const isAdmin = kullaniciBilgisi?.rol === 'admin';
    const benimYorumum = yorum.kullaniciId === user?.uid;

    const options: any[] = [
      { text: "Vazgeç", style: "cancel" }
    ];

    if (!benimYorumum) {
      options.push({ text: "Yorumu Şikayet Et", style: "destructive", onPress: () => Alert.alert("İletildi", "Yorum incelenmek üzere adminlere bildirildi.") });
    }

    if (isAdmin || benimYorumum) {
      options.push({
        text: "YORUMU SİL", style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'topluluk', post.id), {
              yorumlar: arrayRemove(yorum)
            });
            Alert.alert("Başarılı", "Yorum kalıcı olarak silindi.");
          } catch (e) {
            Alert.alert("Hata", "Yorum silinemedi.");
          }
        }
      });
    }

    Alert.alert("Yorum Seçenekleri", "Bu yorum için ne yapmak istiyorsun?", options);
  };

  const arkadasIstegiGonder = async (kisiId: string) => {
    try {
      await updateDoc(doc(db, 'kullanicilar', kisiId), { gelenIstekler: arrayUnion(user!.uid) });
      Alert.alert("İstek Gönderildi! 📨", "Karşı taraf kabul ettiğinde arkadaş olacaksınız.");
    } catch (error) { }
  };

  const postuSikayetEt = (item: any) => {
    const isAdmin = kullaniciBilgisi?.rol === 'admin';
    
    const options: any[] = [
        { text: "Vazgeç", style: "cancel" },
        { text: "Şikayet Et", style: "destructive", onPress: () => Alert.alert("İletildi", "Gereği yapılacaktır.") }
    ];

    if (isAdmin && !item.isSponsor) {
      options.push({
        text: "POSTU SİL (ADMIN)", style: "destructive",
        onPress: async () => { await deleteDoc(doc(db, 'topluluk', item.id)); Alert.alert("Başarılı", "Post admin tarafından kaldırıldı."); }
      });
    }
    Alert.alert("İşlem Seçin", "Bu post hakkında ne yapmak istersiniz?", options);
  };

  const renderMesaj = ({ item }: { item: any }) => {
    const benBegendimMi = item.begenenler?.includes(user?.uid);
    const oneriMi = item.tip === 'oneri';
    const benimPostum = item.kullaniciId === user?.uid;
    const zatenArkadasMi = kullaniciBilgisi?.arkadaslar?.includes(item.kullaniciId);
    const yazarMadalya = getMadalya(item.yazarToplamBagis || 0);
    const yorumSayisi = item.yorumlar?.length || 0;

    return (
      <View style={[styles.mesajKutusu, oneriMi && styles.oneriKutusu]}>
      {oneriMi && (
          <View style={styles.oneriEtiket}><Ionicons name="location" size={14} color="white" /><Text style={styles.oneriEtiketYazi}>YENİ ORMAN ÖNERİSİ</Text></View>
      )}
      
      {item.isSponsor && (
          <View style={{backgroundColor: '#fff9e6', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ffe082'}}>
              <Text style={{fontSize: 11, fontWeight: 'bold', color: '#f57f17'}}>SPONSORLU</Text>
          </View>
      )}

      <View style={styles.mesajUst}>
        <TouchableOpacity 
          style={{flexDirection: 'row', alignItems: 'center'}}
            onPress={() => item.kullaniciId === user?.uid ? router.push('/profile') : router.push(`/baska-profil?id=${item.kullaniciId}`)}
          >
            <Image source={{ uri: item.profilFoto }} style={styles.profilFoto} />
            <View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.yazarAd}>@{item.yazarAd}</Text>
                <Ionicons name={yazarMadalya.ikon as any} size={14} color={yazarMadalya.renk} style={{marginLeft: 5}} />
                {!benimPostum && !zatenArkadasMi && !item.isSponsor && (
                    <TouchableOpacity style={styles.arkadasEkleBtn} onPress={() => arkadasIstegiGonder(item.kullaniciId)}>
                        <Ionicons name="person-add" size={14} color="#2e8b57" />
                    </TouchableOpacity>
                )}
              </View>
              <Text style={{fontSize: 11, color: yazarMadalya.renk, fontWeight: 'bold'}}>{yazarMadalya.ad}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => postuSikayetEt(item)}><Ionicons name="ellipsis-horizontal" size={20} color="#999" /></TouchableOpacity>
        </View>
        {item.metin ? <Text style={styles.metin}>{item.metin}</Text> : null}
        {item.eklenenResim && <Image source={{ uri: item.eklenenResim }} style={styles.postResmi} />}
        {oneriMi && item.enlem && (
            <TouchableOpacity style={styles.konumGosterimKutusu} onPress={() => { setGosterilecekKonum({ lat: item.enlem, lng: item.boylam }); setKonumGosterModalAcik(true); }}>
                <Ionicons name="map-outline" size={16} color="#2e8b57" /><Text style={styles.konumGosterimYazi}>Haritada Gör</Text>
            </TouchableOpacity>
        )}
        <View style={styles.etkilesimBar}>
            <TouchableOpacity style={styles.etkilesimButon} onPress={() => begeniyiTetikle(item)}>
                <Ionicons name={benBegendimMi ? "heart" : "heart-outline"} size={22} color={benBegendimMi ? "#e57373" : "#666"} />
                <Text style={[styles.etkilesimSayi, benBegendimMi && {color: '#e57373'}]}>{item.begeniSayisi || 0}</Text>
            </TouchableOpacity>
            
            {!item.isSponsor && (
                <TouchableOpacity style={styles.etkilesimButon} onPress={() => { setAktifPostId(item.id); setYorumModalAcik(true); }}>
                    <Ionicons name="chatbubble-outline" size={20} color="#666" />
                    <Text style={styles.etkilesimSayi}>{yorumSayisi}</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>
    );
  };

  const pickerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body { margin: 0; padding: 0; } #map { height: 100vh; width: 100vw; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${geciciKonum.lat}, ${geciciKonum.lng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        var marker = L.marker([${geciciKonum.lat}, ${geciciKonum.lng}], {draggable: true}).addTo(map);
        
        marker.on('dragend', function(e) { window.ReactNativeWebView.postMessage(JSON.stringify(marker.getLatLng())); });
        map.on('click', function(e) { marker.setLatLng(e.latlng); window.ReactNativeWebView.postMessage(JSON.stringify(e.latlng)); });
      </script>
    </body>
    </html>
  `;

  const aktifPostVerisi = gosterilecekMesajlar.find(m => m.id === aktifPostId);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={styles.container}>
      <View style={styles.ustAlan}>
        <Text style={styles.baslik}>Keşfet 🌍</Text>
        <Text style={styles.altBaslik}>Topluluğun doğa hareketlerini takip et.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtreBar}>
          <TouchableOpacity style={[styles.filtreButon, aktifFiltre === 'yeni' && styles.aktifFiltreButon]} onPress={() => setAktifFiltre('yeni')}>
            <Text style={[styles.filtreYazi, aktifFiltre === 'yeni' && styles.aktifFiltreYazi]}>En Yeni</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtreButon, aktifFiltre === 'populer' && styles.aktifFiltreButon]} onPress={() => setAktifFiltre('populer')}>
            <Text style={[styles.filtreYazi, aktifFiltre === 'populer' && styles.aktifFiltreYazi]}>En Popüler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtreButon, aktifFiltre === 'yardim' && styles.aktifFiltreButon]} onPress={() => setAktifFiltre('yardim')}>
            <Text style={[styles.filtreYazi, aktifFiltre === 'yardim' && styles.aktifFiltreYazi]}>Öneriler</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {yukleniyor ? <ActivityIndicator size="large" color="#2e8b57" style={{ flex: 1 }} /> : (
        <FlatList 
            data={gosterilecekMesajlar} 
            keyExtractor={(item) => item.id} 
            renderItem={renderMesaj} 
            contentContainerStyle={styles.liste} 
            showsVerticalScrollIndicator={false} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e8b57" />}
        />
      )}

      <View style={styles.girdiAlaniKapsayici}>
        {secilenResim && (
            <View style={styles.onizlemeKutusu}>
                <Image source={{uri: secilenResim}} style={styles.onizlemeResim} />
                <TouchableOpacity style={styles.onizlemeKapat} onPress={() => setSecilenResim(null)}><Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.6)" /></TouchableOpacity>
            </View>
        )}
        <View style={styles.girdiAlani}>
          <TouchableOpacity style={styles.ekleButon} onPress={fotoSec}><Ionicons name="image-outline" size={24} color="#666" /></TouchableOpacity>
          <TouchableOpacity style={[styles.ekleButon, oneriModu && {backgroundColor: '#e8f5e9', borderRadius: 10}]} onPress={() => { oneriModu ? oneriIptal() : haritaSeciminiAc() }}>
              <Ionicons name="location-outline" size={24} color={oneriModu ? "#2e8b57" : "#666"} />
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder={oneriModu ? "Kanıt zorunlu! (+200 Puan)" : "Neler oluyor? (+50 Puan)"} value={yeniMesaj} onChangeText={setYeniMesaj} multiline maxLength={300} />
          
          <TouchableOpacity style={[styles.gonderButon, gonderimKapali && { backgroundColor: '#a5d6a7' }]} onPress={mesajGonder} disabled={gonderimKapali || resimYukleniyor}>
            {resimYukleniyor ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={20} color="white" />}
          </TouchableOpacity>

        </View>
      </View>

      {/* İŞTE DEĞİŞEN KLAVYE MODALI BURADA */}
      <Modal visible={yorumModalAcik} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={styles.modalArkaPlan}>
          <View style={styles.yorumKutu}>
            <View style={styles.modalUstBar}>
              <Text style={styles.modalUstBaslik}>Yorumlar</Text>
              <TouchableOpacity onPress={() => { setYorumModalAcik(false); setAktifPostId(null); }}><Ionicons name="close-circle" size={32} color="#ccc" /></TouchableOpacity>
            </View>
            
            <FlatList
              data={aktifPostVerisi?.yorumlar || []}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.yorumSatiri} 
                  onLongPress={() => yorumYonetimi(item, aktifPostVerisi)}
                  delayLongPress={500}
                >
                  <Image source={{uri: item.profilFoto || 'https://via.placeholder.com/40'}} style={styles.yorumAvatar} />
                  <View style={styles.yorumIcerik}>
                      <Text style={styles.yorumYazar}>@{item.kullaniciAd}</Text>
                      <Text style={styles.yorumMetin}>{item.metin}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.bosListeYazi}>Henüz yorum yok. İlk yorumu sen yap!</Text>}
            />

            <View style={styles.yorumInputKapsayici}>
                <TextInput style={styles.yorumInput} placeholder="Yorum yaz..." value={yeniYorum} onChangeText={setYeniYorum} multiline />
                <TouchableOpacity style={[styles.yorumGonderBtn, !yeniYorum.trim() && {opacity: 0.5}]} onPress={yorumGonder} disabled={!yeniYorum.trim()}>
                    <Ionicons name="arrow-up" size={24} color="white" />
                </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={haritaModalAcik} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={[styles.modalUstBar, {paddingTop: Platform.OS === 'ios' ? 50 : 20}]} >
            <TouchableOpacity onPress={() => setHaritaModalAcik(false)}><Ionicons name="arrow-back" size={28} color="#333" /></TouchableOpacity>
            <Text style={styles.modalUstBaslik}>Alan Seç (Pini Kaydır)</Text>
            <View style={{width: 28}} />
          </View>
          <WebView source={{ html: pickerHtml }} onMessage={(e) => setGeciciKonum(JSON.parse(e.nativeEvent.data))} />
          <TouchableOpacity style={styles.konumOnayButon} onPress={konumSeciminiOnayla}>
            <Text style={styles.konumOnayYazi}>Burayı Seç</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={konumGosterModalAcik} animationType="fade">
        <View style={{ flex: 1 }}>
          <View style={[styles.modalUstBar, {paddingTop: Platform.OS === 'ios' ? 50 : 20}]}>
            <TouchableOpacity onPress={() => setKonumGosterModalAcik(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
            <Text style={styles.modalUstBaslik}>Önerilen Alan</Text>
            <View style={{width: 28}} />
          </View>
          {gosterilecekKonum && (
            <WebView source={{ html: `
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script></head><body style="margin:0"><div id="map" style="height:100vh"></div><script>var map = L.map('map').setView([${gosterilecekKonum.lat}, ${gosterilecekKonum.lng}], 15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);L.marker([${gosterilecekKonum.lat}, ${gosterilecekKonum.lng}]).addTo(map);</script></body></html>` 
            }} />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f8f5', paddingTop: 50 },
  ustAlan: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  baslik: { fontSize: 26, fontWeight: 'bold', color: '#1b5e20' },
  altBaslik: { fontSize: 14, color: '#666', marginTop: 5 },
  filtreBar: { flexDirection: 'row', marginTop: 15, paddingBottom: 5 },
  filtreButon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f8e9', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#e8f5e9' },
  aktifFiltreButon: { backgroundColor: '#2e8b57', borderColor: '#2e8b57' },
  filtreYazi: { fontSize: 13, fontWeight: 'bold', color: '#666' },
  aktifFiltreYazi: { color: 'white' },
  liste: { padding: 15, paddingBottom: 20 },
  bosListeYazi: { textAlign: 'center', color: '#888', marginTop: 50, fontSize: 15, fontStyle: 'italic', paddingHorizontal: 20 },
  mesajKutusu: { backgroundColor: 'white', padding: 15, borderRadius: 20, marginBottom: 15, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0' },
  oneriKutusu: { borderColor: '#2e8b57', borderWidth: 2 }, 
  oneriEtiket: { flexDirection: 'row', backgroundColor: '#2e8b57', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  oneriEtiketYazi: { color: 'white', fontWeight: 'bold', fontSize: 10, marginLeft: 4 },
  mesajUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  profilFoto: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#ddd', marginRight: 12 },
  yazarAd: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  arkadasEkleBtn: { backgroundColor: '#e8f5e9', padding: 4, borderRadius: 15, marginLeft: 10, borderWidth: 1, borderColor: '#c8e6c9' },
  metin: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 10 },
  postResmi: { width: '100%', height: 200, borderRadius: 15, marginBottom: 10 },
  konumGosterimKutusu: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', padding: 10, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10, borderWidth: 1, borderColor: '#c8e6c9' },
  konumGosterimYazi: { fontSize: 13, color: '#2e8b57', fontWeight: 'bold', marginLeft: 6 },
  etkilesimBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#f0f0f0', paddingTop: 10, marginTop: 5 },
  etkilesimButon: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  etkilesimSayi: { marginLeft: 5, fontSize: 14, color: '#666', fontWeight: 'bold' },
  girdiAlaniKapsayici: { backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 30 : 10 },
  onizlemeKutusu: { padding: 10, paddingLeft: 20, flexDirection: 'row' },
  onizlemeResim: { width: 60, height: 60, borderRadius: 10 },
  onizlemeKapat: { position: 'absolute', top: 5, left: 65 },
  girdiAlani: { flexDirection: 'row', alignItems: 'flex-end', padding: 15 },
  ekleButon: { padding: 8, marginRight: 5, marginBottom: 2 },
  input: { flex: 1, backgroundColor: '#f1f8e9', borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, fontSize: 15, color: '#333' },
  gonderButon: { backgroundColor: '#2e8b57', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2, elevation: 2 },
  
  modalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  /* YORUM KUTUSU STİLİ BURADA GÜNCELLENDİ */
  yorumKutu: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%', minHeight: '50%', paddingHorizontal: 20, paddingBottom: 20 },
  modalUstBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  modalUstBaslik: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  yorumSatiri: { flexDirection: 'row', marginTop: 15, borderBottomWidth: 1, borderColor: '#f9f9f9', paddingBottom: 10 },
  yorumAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  yorumIcerik: { flex: 1, backgroundColor: '#f1f8e9', padding: 12, borderRadius: 15, borderTopLeftRadius: 2 },
  yorumYazar: { fontWeight: 'bold', color: '#1b5e20', fontSize: 13, marginBottom: 3 },
  yorumMetin: { color: '#444', fontSize: 14, lineHeight: 20 },
  yorumInputKapsayici: { flexDirection: 'row', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#eee', paddingTop: 15 },
  yorumInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, minHeight: 45, fontSize: 14 },
  yorumGonderBtn: { backgroundColor: '#2e8b57', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  sabitPimKapsayici: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -24, zIndex: 1 },
  konumOnayButon: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#2e8b57', padding: 15, borderRadius: 20, elevation: 5 },
  konumOnayYazi: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});