import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function BaskaProfilScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = auth.currentUser;

  const [kisiData, setKisiData] = useState<any>(null);
  const [postlar, setPostlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [benimVerim, setBenimVerim] = useState<any>(null);

  const [seciliPost, setSeciliPost] = useState<any>(null);
  const [postModalAcik, setPostModalAcik] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    const veriGetir = async () => {
      const benSnap = await getDoc(doc(db, 'kullanicilar', user.uid));
      if (benSnap.exists()) setBenimVerim(benSnap.data());

      const kisiSnap = await getDoc(doc(db, 'kullanicilar', id as string));
      if (kisiSnap.exists()) setKisiData({ id: kisiSnap.id, ...kisiSnap.data() });

      const q = query(collection(db, 'topluluk'), where('kullaniciId', '==', id));
      const postSnap = await getDocs(q);
      const pList = postSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
                    .filter((p: any) => p.eklenenResim && p.tip !== 'oneri')
                    .sort((a:any, b:any) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setPostlar(pList);
      setYukleniyor(false);
    };
    veriGetir();
  }, [id, user]);

  const arkadasIstegiGonder = async () => {
    try {
      await updateDoc(doc(db, 'kullanicilar', kisiData.id), { gelenIstekler: arrayUnion(user!.uid) });
      Alert.alert("Başarılı", "İstek gönderildi! 📨");
      setKisiData({...kisiData, gelenIstekler: [...(kisiData.gelenIstekler || []), user!.uid]});
    } catch (error) { Alert.alert("Hata", "İşlem başarısız."); }
  };

  // ADMİN İÇİN BANLAMA FONKSİYONU
  const kullaniciyiBanla = () => {
    Alert.alert(
      "DİKKAT: Kullanıcı Yasaklama",
      `@${kisiData.kullaniciAdi} isimli kullanıcıyı kalıcı olarak banlamak istediğinize emin misiniz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Yasakla", 
          style: "destructive", 
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'kullanicilar', kisiData.id), { durum: 'yasakli' });
              Alert.alert("İşlem Tamam", "Kullanıcı yasaklandı ve erişimi kesildi.");
              router.back();
            } catch (e) { Alert.alert("Hata", "Banlama başarısız."); }
          }
        }
      ]
    );
  };

  const getMadalya = (toplam: number) => {
    if (toplam >= 10000) return { ad: "Ormanların Yüce Kralı", renk: "#00bcd4", ikon: "diamond" };
    if (toplam >= 1000) return { ad: "Altın Ağaç", renk: "#ffd700", ikon: "trophy" };
    if (toplam >= 100) return { ad: "Gümüş Dal", renk: "#c0c0c0", ikon: "leaf" };
    if (toplam >= 10) return { ad: "Bronz Yaprak", renk: "#cd7f32", ikon: "medal" };
    return { ad: "Çaylak Çevreci", renk: "#888", ikon: "leaf-outline" };
  };

  if (yukleniyor) return <View style={styles.merkez}><ActivityIndicator size="large" color="#2e8b57" /></View>;
  if (!kisiData) return <View style={styles.merkez}><Text>Kullanıcı bulunamadı.</Text></View>;

  const madalya = getMadalya(kisiData.toplamBagis || 0);
  const zatenArkadasMi = benimVerim?.arkadaslar?.includes(kisiData.id);
  const istekGonderildiMi = kisiData.gelenIstekler?.includes(user?.uid);
  const isAdmin = benimVerim?.rol === 'admin';

  return (
    <View style={styles.anaEkran}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.ustBar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color="#333" /></TouchableOpacity>
        <Text style={styles.ustBarBaslik}>Doğa Dostu Profili</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={{ uri: kisiData.profilFoto }} style={styles.profilFoto} />
          <Text style={styles.isim}>@{kisiData.kullaniciAdi}</Text>
          <Text style={styles.biyografi}>{kisiData.biyografi || 'Doğa Dostu 🌿'}</Text>

          <View style={{flexDirection: 'row', marginTop: 15}}>
            {!zatenArkadasMi && (
                <TouchableOpacity 
                    style={[styles.ekleButon, istekGonderildiMi && {backgroundColor: '#ccc'}]} 
                    onPress={istekGonderildiMi ? undefined : arkadasIstegiGonder}
                >
                    <Ionicons name={istekGonderildiMi ? "time" : "person-add"} size={16} color="white" />
                    <Text style={styles.ekleYazi}>{istekGonderildiMi ? " Beklemede" : " Arkadaş Ekle"}</Text>
                </TouchableOpacity>
            )}

            {/* ADMİN BUTONU: Sadece adminler görür */}
            {isAdmin && (
                <TouchableOpacity style={styles.banButon} onPress={kullaniciyiBanla}>
                    <Ionicons name="ban" size={16} color="white" />
                    <Text style={styles.ekleYazi}> Yasakla</Text>
                </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Diğer kısımlar (İstatistik, Madalya, Galeri) aynı kalıyor... */}
        <View style={styles.istatistikKutusu}>
          <View style={styles.istatistik}><Text style={styles.sayi}>{kisiData.fidanSayisi || 0}</Text><Text style={styles.etiket}>Fidan</Text></View>
          <View style={styles.istatistik}><Text style={[styles.sayi, {color: '#f57f17'}]}>{kisiData.puan || 0}</Text><Text style={styles.etiket}>Puan</Text></View>
        </View>

        <View style={styles.tamGenislikKutu}>
          <Text style={styles.bolumBasligi}>Başarı Unvanı</Text>
          <View style={styles.madalyaIcerik}>
              <View style={[styles.madalyaIkonKutusu, { backgroundColor: madalya.renk + '20' }]}><Ionicons name={madalya.ikon as any} size={40} color={madalya.renk} /></View>
              <View style={styles.madalyaMetinAlani}>
                  <Text style={[styles.madalyaAdi, { color: madalya.renk }]}>{madalya.ad}</Text>
                  <Text style={styles.toplamBagisYazisi}>Toplam {kisiData.toplamBagis || 0} fidan bağışladı.</Text>
              </View>
          </View>
        </View>

        <View style={[styles.tamGenislikKutu, { paddingHorizontal: 15 }]}>
          <Text style={[styles.bolumBasligi, {marginLeft: 5}]}>Doğa Günlüğü</Text>
          {postlar.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#888', marginVertical: 20, fontStyle: 'italic'}}>Henüz fotoğraf paylaşmadı.</Text>
          ) : (
            <View style={styles.gridKapsayici}>
              {postlar.map((post) => (
                <TouchableOpacity key={post.id} style={styles.gridOge} onPress={() => { setSeciliPost(post); setPostModalAcik(true); }}>
                  <Image source={{ uri: post.eklenenResim }} style={styles.gridResim} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Post Modal kısmı aynı... */}
      <Modal visible={postModalAcik} animationType="fade" transparent>
        <View style={styles.postModalArkaPlan}>
          <TouchableOpacity style={styles.postKapatButon} onPress={() => setPostModalAcik(false)}><Ionicons name="close" size={36} color="white" /></TouchableOpacity>
          {seciliPost && (
            <View style={styles.postModalIcerik}>
              <Image source={{ uri: seciliPost.eklenenResim }} style={styles.postModalResim} resizeMode="contain" />
              <View style={styles.postModalAltBar}>
                <Ionicons name="heart" size={32} color="#e57373" />
                <Text style={styles.postModalBegeniYazi}>{seciliPost.begeniSayisi || 0} Beğeni</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anaEkran: { flex: 1, backgroundColor: '#f1f8e9' },
  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ustBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, elevation: 3 },
  ustBarBaslik: { fontSize: 18, fontWeight: 'bold', color: '#1b5e20' },
  container: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, width: '100%' },
  profilFoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#2e8b57', marginBottom: 15 },
  isim: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  biyografi: { color: '#666', textAlign: 'center', paddingHorizontal: 40, marginTop: 5, fontStyle: 'italic' },
  ekleButon: { flexDirection: 'row', backgroundColor: '#2e8b57', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', elevation: 2, marginRight: 10 },
  banButon: { flexDirection: 'row', backgroundColor: '#e57373', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', elevation: 2 },
  ekleYazi: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
  istatistikKutusu: { flexDirection: 'row', backgroundColor: 'white', width: '100%', padding: 20, borderRadius: 25, justifyContent: 'space-around', elevation: 3, marginBottom: 20 },
  istatistik: { alignItems: 'center' },
  sayi: { fontSize: 22, fontWeight: 'bold', color: '#2e8b57' },
  etiket: { color: '#88a090', fontSize: 13, marginTop: 4 },
  tamGenislikKutu: { backgroundColor: 'white', width: '100%', borderRadius: 20, padding: 20, elevation: 3, marginBottom: 15 },
  bolumBasligi: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  madalyaIcerik: { flexDirection: 'row', alignItems: 'center' },
  madalyaIkonKutusu: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  madalyaMetinAlani: { flex: 1 },
  madalyaAdi: { fontSize: 16, fontWeight: 'bold', marginBottom: 3 },
  toplamBagisYazisi: { fontSize: 12, color: '#888' },
  gridKapsayici: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridOge: { width: '33.33%', padding: 5, aspectRatio: 1 },
  gridResim: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#eee' },
  postModalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  postKapatButon: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  postModalIcerik: { width: '100%', alignItems: 'center' },
  postModalResim: { width: '100%', height: 400 },
  postModalAltBar: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  postModalBegeniYazi: { color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 10 }
});