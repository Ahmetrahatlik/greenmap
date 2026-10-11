import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';

import { signOut } from 'firebase/auth';
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs,
  increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function ProfileScreen() {
  const user = auth.currentUser;
  const router = useRouter();

  const [profilData, setProfilData] = useState<any>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [duzenleEkraniAcik, setDuzenleEkraniAcik] = useState(false);
  const [cuzdanEkraniAcik, setCuzdanEkraniAcik] = useState(false);
  const [odemeModalAcik, setOdemeModalAcik] = useState(false);
  const [alinacakAdet, setAlinacakAdet] = useState(0);
  const [kartNo, setKartNo] = useState('');
  const [kartIsim, setKartIsim] = useState('');
  const [kartTarih, setKartTarih] = useState('');
  const [kartCvv, setKartCvv] = useState('');
  
  const [duzenleAd, setDuzenleAd] = useState('');
  const [duzenleBio, setDuzenleBio] = useState('');
  const [duzenleFoto, setDuzenleFoto] = useState('');
  const [ozelFidanAdedi, setOzelFidanAdedi] = useState('');

  const [arkadasModalAcik, setArkadasModalAcik] = useState(false);
  const [sosyalSekme, setSosyalSekme] = useState('arkadaslar'); 
  const [sohbetModalAcik, setSohbetModalAcik] = useState(false);
  const [eklenecekNick, setEklenecekNick] = useState('');
  
  const [arkadasDetaylari, setArkadasDetaylari] = useState<any[]>([]);
  const [istekDetaylari, setIstekDetaylari] = useState<any[]>([]);
  const [seciliArkadas, setSeciliArkadas] = useState<any>(null);
  const [mesajlar, setMesajlar] = useState<any[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState('');

  const [yeniMesajVar, setYeniMesajVar] = useState(true); 
  const hizliEmojiler = ['🌳', '💚', '🔥', '😂', '🌍', '💧', '👏', '😍', '🍂'];

  const [kullaniciPostlari, setKullaniciPostlari] = useState<any[]>([]);
  const [postModalAcik, setPostModalAcik] = useState(false);
  const [seciliPost, setSeciliPost] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'kullanicilar', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfilData({
            ...data,
            fidanSayisi: data.fidanSayisi || 0, puan: data.puan || 0, toplamBagis: data.toplamBagis || 0,
            arkadaslar: data.arkadaslar || [], gelenIstekler: data.gelenIstekler || [], isimDegistirmeHakki: data.isimDegistirmeHakki || 0
        });
      }
      setYukleniyor(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'topluluk'), where('kullaniciId', '==', user.uid));
    const unsubscribePosts = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const galeriFotolari = posts
        .filter((p: any) => p.eklenenResim && p.tip !== 'oneri')
        .sort((a: any, b: any) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setKullaniciPostlari(galeriFotolari);
    });
    return () => unsubscribePosts();
  }, [user]);

  useEffect(() => {
    const kisileriGetir = async () => {
        const arkListe: any[] = [];
        const isListe: any[] = [];
        
        if (profilData.arkadaslar && profilData.arkadaslar.length > 0) {
            const arkadasPromisleri = profilData.arkadaslar.map((id: string) => getDoc(doc(db, 'kullanicilar', id)));
            const arkadasSnapshots = await Promise.all(arkadasPromisleri);
            arkadasSnapshots.forEach(snap => {
                if (snap.exists()) arkListe.push({ id: snap.id, ...snap.data() });
            });
        }
        
        if (profilData.gelenIstekler && profilData.gelenIstekler.length > 0) {
            const istekPromisleri = profilData.gelenIstekler.map((id: string) => getDoc(doc(db, 'kullanicilar', id)));
            const istekSnapshots = await Promise.all(istekPromisleri);
            istekSnapshots.forEach(snap => {
                if (snap.exists()) isListe.push({ id: snap.id, ...snap.data() });
            });
        }
        
        setArkadasDetaylari(arkListe);
        setIstekDetaylari(isListe);
    };

    if (profilData.arkadaslar || profilData.gelenIstekler) {
        kisileriGetir();
    }
  }, [profilData.arkadaslar, profilData.gelenIstekler]);

  useEffect(() => {
    if (!seciliArkadas || !user) return;
    const odaId = [user.uid, seciliArkadas.id].sort().join('_');
    const q = query(collection(db, 'sohbetler', odaId, 'mesajlar'), orderBy('tarih', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const msj = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMesajlar(msj);
    });
    return () => unsubscribe();
  }, [seciliArkadas]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); }, 1200);
  };

  const arkadasIstegiGonder = async () => {
    if (!eklenecekNick.trim()) return Alert.alert("Hata", "Lütfen bir kullanıcı adı girin.");
    if (eklenecekNick.toLowerCase() === profilData.kullaniciAdi?.toLowerCase()) return Alert.alert("Hata", "Kendine istek atamazsın! 😅");

    try {
        const q = query(collection(db, 'kullanicilar'), where('kullaniciAdi', '==', eklenecekNick.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (snap.empty) return Alert.alert("Bulunamadı", "Bu nicke sahip biri yok.");

        const eklenecekKisiId = snap.docs[0].id;
        const eklenecekKisiData = snap.docs[0].data();

        if (profilData.arkadaslar?.includes(eklenecekKisiId)) return Alert.alert("Zaten Arkadaşsınız", "Bu kişiyle zaten yeşil yoldasınız!");
        if (eklenecekKisiData.gelenIstekler?.includes(user!.uid)) return Alert.alert("Beklemede", "Bu kişiye zaten istek gönderdin.");

        await updateDoc(doc(db, 'kullanicilar', eklenecekKisiId), { gelenIstekler: arrayUnion(user!.uid as any) });
        setEklenecekNick('');
        Alert.alert("İstek Gönderildi! 📨", `${eklenecekNick} isteğini kabul ettiğinde arkadaş olacaksınız.`);
    } catch (error) { Alert.alert("Hata", "İstek gönderilemedi."); }
  };

  const istegiKabulEt = async (kisiId: string) => {
    try {
        await updateDoc(doc(db, 'kullanicilar', user!.uid), { arkadaslar: arrayUnion(kisiId as any), gelenIstekler: arrayRemove(kisiId as any) });
        await updateDoc(doc(db, 'kullanicilar', kisiId), { arkadaslar: arrayUnion(user!.uid as any) });
        Alert.alert("Kabul Edildi!", "Artık arkadaşsınız! 🌳");
    } catch (e) { Alert.alert("Hata", "Kabul edilemedi."); }
  };

  const istegiReddet = async (kisiId: string) => {
    try { await updateDoc(doc(db, 'kullanicilar', user!.uid), { gelenIstekler: arrayRemove(kisiId as any) }); } catch (e) {}
  };

  const mesajGonder = async () => {
    if (!yeniMesaj.trim() || !seciliArkadas || !user) return;
    const odaId = [user.uid, seciliArkadas.id].sort().join('_');
    try {
        await addDoc(collection(db, 'sohbetler', odaId, 'mesajlar'), { gonderenId: user.uid, metin: yeniMesaj.trim(), tarih: serverTimestamp() });
        setYeniMesaj('');
    } catch (error) {}
  };

  const emojiEkle = (emoji: string) => { setYeniMesaj(prev => prev + emoji); };

  const dmKutusunuAc = () => {
    setSosyalSekme('arkadaslar'); 
    setArkadasModalAcik(true);
    setYeniMesajVar(false); 
  };

  const fidanPaketiSec = (adet: number) => {
    if(isNaN(adet) || adet <= 0) return;
    setAlinacakAdet(adet);
    setCuzdanEkraniAcik(false); 
    setOdemeModalAcik(true); 
  };

  const odemeOnayla = async () => {
    if(!kartNo || !kartIsim || !kartTarih || !kartCvv) {
        return Alert.alert("Eksik Bilgi", "Lütfen tüm kart bilgilerini doldurunuz.");
    }
    try {
        await updateDoc(doc(db, 'kullanicilar', user!.uid), { fidanSayisi: increment(alinacakAdet) });
        setOdemeModalAcik(false);
        setOzelFidanAdedi('');
        setKartNo(''); setKartIsim(''); setKartTarih(''); setKartCvv('');
        Alert.alert("Ödeme Başarılı! 🎉", `${alinacakAdet} fidan cüzdanına yüklendi. Artık doğaya can verebilirsin!`);
    } catch (e) { 
        Alert.alert("Hata", "İşlem başarısız."); 
    }
  };

  const profiliKaydet = async () => {
    if (!user || duzenleAd.trim() === '') return;
    const isimDegistirilmekIsteniyor = duzenleAd.trim() !== profilData.kullaniciAdi;

    try {
      if (isimDegistirilmekIsteniyor) {
        if ((profilData.isimDegistirmeHakki || 0) <= 0) {
          return Alert.alert("Hakkın Yok! 🛑", "İsmini değiştirmek için Doğa Mağazası'ndan hak almalısın.");
        }
        const q = query(collection(db, 'kullanicilar'), where('kullaniciAdi', '==', duzenleAd.trim()));
        const snap = await getDocs(q);
        let isimAlinmis = false;
        snap.forEach(d => { if (d.id !== user.uid) isimAlinmis = true; });
        if (isimAlinmis) return Alert.alert("Hata", "Bu kullanıcı adı zaten alınmış!");
      }

      const guncellenecekVeri: any = { biyografi: duzenleBio.trim(), profilFoto: duzenleFoto };
      if (isimDegistirilmekIsteniyor) {
        guncellenecekVeri.kullaniciAdi = duzenleAd.trim();
        guncellenecekVeri.isimDegistirmeHakki = increment(-1); 
      }

      await updateDoc(doc(db, 'kullanicilar', user.uid), guncellenecekVeri);
      setDuzenleEkraniAcik(false);
      if (isimDegistirilmekIsteniyor) Alert.alert("Tebrikler! 🎉", "Kullanıcı adın başarıyla değiştirildi.");
    } catch (e) {
      Alert.alert("Hata", "Profil güncellenirken bir sorun oluştu.");
    }
  };

  const fotoSec = async () => {
    let sonuc = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!sonuc.canceled) setDuzenleFoto(sonuc.assets[0].uri);
  };

  const getMadalya = (toplam: number) => {
    if (toplam >= 10000) return { ad: "Ormanların Yüce Kralı 👑", renk: "#00bcd4", ikon: "diamond" };
    if (toplam >= 1000) return { ad: "Altın Ağaç 🌳", renk: "#ffd700", ikon: "trophy" };
    if (toplam >= 100) return { ad: "Gümüş Dal 🌿", renk: "#c0c0c0", ikon: "leaf" };
    if (toplam >= 10) return { ad: "Bronz Yaprak 🍂", renk: "#cd7f32", ikon: "medal" };
    return { ad: "Çaylak Çevreci 🌱", renk: "#888", ikon: "leaf-outline" };
  };

  if (yukleniyor) return <View style={styles.merkez}><ActivityIndicator size="large" color="#2e8b57" /></View>;
  const madalya = getMadalya(profilData.toplamBagis || 0);

  return (
    <View style={styles.anaEkran}>
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e8b57" />}
      >
        <View style={styles.header}>
          <Image source={{ uri: profilData.profilFoto || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=200&q=80' }} style={styles.profilFoto} />
          <Text style={styles.isim}>@{profilData.kullaniciAdi}</Text>
          <Text style={styles.biyografi}>{profilData.biyografi}</Text>
          
          <View style={styles.butonGrubu}>
              <TouchableOpacity style={styles.kucukButon} onPress={() => { setDuzenleAd(profilData.kullaniciAdi); setDuzenleBio(profilData.biyografi); setDuzenleFoto(profilData.profilFoto); setDuzenleEkraniAcik(true); }}>
                  <Text style={styles.kucukButonYazi}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.kucukButon, {backgroundColor: '#2e8b57'}]} onPress={() => { setSosyalSekme('istekler'); setArkadasModalAcik(true); }}>
                  <Ionicons name="people" size={16} color="white" />
                  {profilData.gelenIstekler?.length > 0 && <View style={styles.bildirimNoktasi} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.kucukButon, {backgroundColor: '#1b5e20'}]} onPress={dmKutusunuAc}>
                  <Ionicons name="chatbubbles" size={16} color="white" />
                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 4}}>DM</Text>
                  {yeniMesajVar && <View style={styles.bildirimNoktasi} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.kucukButon, {backgroundColor: '#f57f17'}]} onPress={() => setCuzdanEkraniAcik(true)}>
                  <Ionicons name="leaf" size={16} color="white" />
              </TouchableOpacity>
          </View>
        </View>

        <View style={styles.istatistikKutusu}>
          <View style={styles.istatistik}><Text style={styles.sayi}>{profilData.fidanSayisi || 0}</Text><Text style={styles.etiket}>Fidanım</Text></View>
          <View style={styles.istatistik}><Text style={[styles.sayi, {color: '#f57f17'}]}>{profilData.puan || 0}</Text><Text style={styles.etiket}>Puanım</Text></View>
        </View>

        <View style={styles.tamGenislikKutu}>
          <Text style={styles.bolumBasligi}>Başarı Unvanın</Text>
          <View style={styles.madalyaIcerik}>
              <View style={[styles.madalyaIkonKutusu, { backgroundColor: madalya.renk + '20' }]}><Ionicons name={madalya.ikon as any} size={40} color={madalya.renk} /></View>
              <View style={styles.madalyaMetinAlani}>
                  <Text style={[styles.madalyaAdi, { color: madalya.renk }]}>{madalya.ad}</Text>
                  <Text style={styles.toplamBagisYazisi}>Toplam {profilData.toplamBagis || 0} fidan bağışladın.</Text>
              </View>
          </View>
        </View>

        <View style={[styles.tamGenislikKutu, { paddingHorizontal: 15 }]}>
          <Text style={[styles.bolumBasligi, {marginLeft: 5}]}>Doğa Günlüğüm</Text>
          {kullaniciPostlari.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#888', marginVertical: 20, fontStyle: 'italic'}}>Henüz fotoğraf paylaşmadın.</Text>
          ) : (
            <View style={styles.gridKapsayici}>
              {kullaniciPostlari.map((post) => (
                <TouchableOpacity key={post.id} style={styles.gridOge} onPress={() => { setSeciliPost(post); setPostModalAcik(true); }}>
                  <Image source={{ uri: post.eklenenResim }} style={styles.gridResim} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.cikisButon} onPress={() => signOut(auth)}>
          <Ionicons name="log-out-outline" size={20} color="#e57373" />
          <Text style={{ color: '#e57373', fontWeight: 'bold', marginLeft: 5 }}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* POST MODALI */}
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

      {/* SOSYAL MEDYA MODALI */}
      <Modal visible={arkadasModalAcik} animationType="slide" transparent>
        <View style={styles.modalArkaPlan}>
          <View style={styles.arkadasKutu}>
            <View style={styles.modalUstBar}>
                <Text style={styles.cuzdanModalBaslik}>Mesajlar & İstekler</Text>
                <TouchableOpacity onPress={() => setArkadasModalAcik(false)}><Ionicons name="close-circle" size={32} color="#ccc" /></TouchableOpacity>
            </View>
            <View style={styles.sosyalSekmeler}>
                <TouchableOpacity style={[styles.sosyalSekmeButon, sosyalSekme === 'arkadaslar' && styles.sosyalSekmeAktif]} onPress={() => setSosyalSekme('arkadaslar')}>
                    <Text style={[styles.sosyalSekmeYazi, sosyalSekme === 'arkadaslar' && {color: '#2e8b57'}]}>Sohbetler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sosyalSekmeButon, sosyalSekme === 'istekler' && styles.sosyalSekmeAktif]} onPress={() => setSosyalSekme('istekler')}>
                    <Text style={[styles.sosyalSekmeYazi, sosyalSekme === 'istekler' && {color: '#2e8b57'}]}>İstekler ({profilData.gelenIstekler?.length || 0})</Text>
                </TouchableOpacity>
            </View>
            {sosyalSekme === 'arkadaslar' ? (
                <View style={{flex: 1}}>
                    <View style={styles.arkadasEkleBar}>
                        <TextInput style={styles.arkadasInput} placeholder="Nick ile istek at..." value={eklenecekNick} onChangeText={setEklenecekNick} autoCapitalize="none" />
                        <TouchableOpacity style={styles.arkadasEkleButon} onPress={arkadasIstegiGonder}><Ionicons name="send" size={20} color="white" /></TouchableOpacity>
                    </View>
                    {arkadasDetaylari.length === 0 ? (
                        <Text style={{textAlign: 'center', color: '#888', marginTop: 20}}>Henüz mesajlaşacak kimse yok.</Text>
                    ) : (
                        <FlatList data={arkadasDetaylari} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
                            renderItem={({item}) => (
                                <View style={styles.arkadasKart}>
                                    <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', flex: 1}} onPress={() => { setArkadasModalAcik(false); router.push(`/baska-profil?id=${item.id}`); }}>
                                        <Image source={{uri: item.profilFoto}} style={styles.arkadasAvatar} />
                                        <View style={{flex: 1}}><Text style={styles.arkadasIsim}>@{item.kullaniciAdi}</Text><Text style={styles.arkadasPuan}>Profili gör</Text></View>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.mesajButon} onPress={() => { setSeciliArkadas(item); setArkadasModalAcik(false); setSohbetModalAcik(true); }}>
                                        <Ionicons name="chatbubbles" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    )}
                </View>
            ) : (
                <View style={{flex: 1}}>
                    {istekDetaylari.length === 0 ? (
                        <Text style={{textAlign: 'center', color: '#888', marginTop: 20}}>Gelen bir arkadaşlık isteğin yok.</Text>
                    ) : (
                        <FlatList data={istekDetaylari} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
                            renderItem={({item}) => (
                                <View style={styles.arkadasKart}>
                                    <Image source={{uri: item.profilFoto}} style={styles.arkadasAvatar} />
                                    <View style={{flex: 1}}><Text style={styles.arkadasIsim}>@{item.kullaniciAdi}</Text><Text style={styles.arkadasPuan}>Seni eklemek istiyor</Text></View>
                                    <View style={{flexDirection: 'row'}}>
                                        <TouchableOpacity style={[styles.mesajButon, {backgroundColor: '#e57373', marginRight: 5}]} onPress={() => istegiReddet(item.id)}><Ionicons name="close" size={20} color="white" /></TouchableOpacity>
                                        <TouchableOpacity style={[styles.mesajButon, {backgroundColor: '#2e8b57'}]} onPress={() => istegiKabulEt(item.id)}><Ionicons name="checkmark" size={20} color="white" /></TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        />
                    )}
                </View>
            )}
          </View>
        </View>
      </Modal>

      {/* SOHBET MODALI */}
      <Modal visible={sohbetModalAcik} animationType="fade" transparent={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sohbetEkrani}>
            <View style={styles.sohbetHeader}>
                <TouchableOpacity onPress={() => { setSohbetModalAcik(false); setSeciliArkadas(null); }}><Ionicons name="arrow-back" size={28} color="#333" /></TouchableOpacity>
                <Image source={{uri: seciliArkadas?.profilFoto}} style={styles.sohbetAvatar} />
                <Text style={styles.sohbetIsim}>@{seciliArkadas?.kullaniciAdi}</Text>
                <View style={{width: 28}} />
            </View>
            <FlatList data={mesajlar} keyExtractor={item => item.id} contentContainerStyle={{padding: 15, paddingBottom: 20}}
                renderItem={({item}) => {
                    const benimMesajim = item.gonderenId === user?.uid;
                    return (
                        <View style={[styles.mesajBalonu, benimMesajim ? styles.benimMesajim : styles.karsiMesaj]}>
                            <Text style={[styles.mesajYazi, benimMesajim && {color: 'white'}]}>{item.metin}</Text>
                        </View>
                    );
                }}
            />
            <View style={styles.emojiBarKapsayici}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {hizliEmojiler.map(emoji => (
                        <TouchableOpacity key={emoji} onPress={() => emojiEkle(emoji)} style={styles.emojiButon}><Text style={styles.emojiText}>{emoji}</Text></TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
            <View style={styles.sohbetInputBar}>
                <TextInput style={styles.sohbetInput} placeholder="Mesaj yaz..." value={yeniMesaj} onChangeText={setYeniMesaj} multiline />
                <TouchableOpacity style={styles.gonderButon} onPress={mesajGonder}><Ionicons name="send" size={20} color="white" /></TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CÜZDAN MODALI */}
      <Modal visible={cuzdanEkraniAcik} animationType="slide" transparent>
        <View style={styles.modalArkaPlan}>
          <View style={styles.cuzdanKutu}>
            <View style={styles.modalUstBar}><Text style={styles.cuzdanModalBaslik}>Fidan Deposu</Text><TouchableOpacity onPress={() => setCuzdanEkraniAcik(false)}><Ionicons name="close-circle" size={32} color="#ccc" /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.paketGrid}>
                    {[5, 10, 20, 50].map((adet) => (
                        <TouchableOpacity key={adet} style={styles.miniPaket} onPress={() => fidanPaketiSec(adet)}>
                            <Text style={styles.miniPaketAdet}>{adet}</Text>
                            <Text style={styles.miniPaketEtiket}>Fidan</Text>
                            <View style={styles.fiyatEtiket}><Text style={styles.fiyatYazi}>{adet * 20} TL</Text></View>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.ozelMiktarKutusu}>
                    <Text style={styles.altBaslik}>Özel Miktar Al</Text>
                    <View style={styles.ozelInputSatir}>
                        <TextInput style={styles.ozelInput} placeholder="Kaç fidan istersin?" keyboardType="numeric" value={ozelFidanAdedi} onChangeText={setOzelFidanAdedi} />
                        <TouchableOpacity style={styles.ozelAlButon} onPress={() => fidanPaketiSec(parseInt(ozelFidanAdedi))}><Ionicons name="cart" size={20} color="white" /></TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ÖDEME EKRANI MODALI */}
      <Modal visible={odemeModalAcik} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalArkaPlan}>
            <View style={styles.odemeKutu}>
                <View style={styles.modalUstBar}>
                    <Text style={styles.cuzdanModalBaslik}>Ödeme Ekranı</Text>
                    <TouchableOpacity onPress={() => setOdemeModalAcik(false)}><Ionicons name="close-circle" size={32} color="#ccc" /></TouchableOpacity>
                </View>
                <View style={styles.krediKartiGorsel}>
                    <Ionicons name="card" size={30} color="white" style={{alignSelf: 'flex-end'}} />
                    <Text style={styles.kartUzeriNo}>{kartNo || '**** **** **** ****'}</Text>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                        <Text style={styles.kartUzeriIsim}>{kartIsim.toUpperCase() || 'AD SOYAD'}</Text>
                        <Text style={styles.kartUzeriTarih}>{kartTarih || 'AA/YY'}</Text>
                    </View>
                </View>
                <View style={styles.odemeOzet}>
                    <Text style={styles.ozetYazi}>Seçilen: <Text style={{fontWeight: 'bold', color: '#1b5e20'}}>{alinacakAdet} Fidan</Text></Text>
                    <Text style={styles.ozetYazi}>Toplam Tutar: <Text style={{fontWeight: 'bold', color: '#1b5e20'}}>{alinacakAdet * 20} TL</Text></Text>
                </View>
                <TextInput style={styles.input} placeholder="Kart Üzerindeki İsim" value={kartIsim} onChangeText={setKartIsim} autoCapitalize="words" />
                <TextInput style={styles.input} placeholder="Kart Numarası" keyboardType="numeric" maxLength={16} value={kartNo} onChangeText={setKartNo} />
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="AA/YY" keyboardType="numeric" maxLength={5} value={kartTarih} onChangeText={setKartTarih} />
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="CVV" keyboardType="numeric" maxLength={3} value={kartCvv} onChangeText={setKartCvv} />
                </View>
                <TouchableOpacity style={styles.kaydetButon} onPress={odemeOnayla}>
                    <Text style={styles.kaydetYazi}>Güvenli Ödeme Yap ({alinacakAdet * 20} TL)</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PROFİL DÜZENLEME MODALI */}
      <Modal visible={duzenleEkraniAcik} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalArkaPlan}>
          <View style={styles.modalKutu}>
            <Text style={styles.modalBaslik}>Bilgilerini Güncelle</Text>
            <TouchableOpacity onPress={fotoSec} style={styles.fotoDuzenleAlan}>
              <Image source={{ uri: duzenleFoto }} style={styles.modalFoto} />
              <View style={styles.kameraIkon}><Ionicons name="camera" size={18} color="white" /></View>
            </TouchableOpacity>
            <TextInput style={styles.input} value={duzenleAd} onChangeText={setDuzenleAd} placeholder="Kullanıcı Adı" autoCapitalize="none" />
            <TextInput style={[styles.input, {height: 80}]} value={duzenleBio} onChangeText={setDuzenleBio} placeholder="Biyografi" multiline />
            <TouchableOpacity style={styles.kaydetButon} onPress={profiliKaydet}><Text style={styles.kaydetYazi}>Değişiklikleri Kaydet</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDuzenleEkraniAcik(false)} style={{marginTop: 15, alignSelf: 'center'}}><Text style={{color: '#666', fontWeight: 'bold'}}>Vazgeç</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anaEkran: { flex: 1, backgroundColor: '#f1f8e9' },
  container: { paddingTop: 60, alignItems: 'center', paddingBottom: 40 },
  merkez: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 20, width: '100%' },
  profilFoto: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#2e8b57', marginBottom: 15 },
  isim: { fontSize: 26, fontWeight: 'bold', color: '#1b5e20' },
  biyografi: { color: '#666', textAlign: 'center', paddingHorizontal: 40, marginTop: 8, fontSize: 14, fontStyle: 'italic' },
  butonGrubu: { flexDirection: 'row', marginTop: 20, justifyContent: 'center' },
  kucukButon: { flexDirection: 'row', backgroundColor: '#c8e6c9', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, marginHorizontal: 4, alignItems: 'center', elevation: 2, position: 'relative' },
  kucukButonYazi: { color: '#1b5e20', fontWeight: 'bold', fontSize: 13 },
  bildirimNoktasi: { position: 'absolute', top: -3, right: -3, width: 14, height: 14, backgroundColor: '#ff5252', borderRadius: 7, borderWidth: 2, borderColor: 'white' },
  istatistikKutusu: { flexDirection: 'row', backgroundColor: 'white', width: '90%', padding: 25, borderRadius: 30, justifyContent: 'space-around', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, marginBottom: 20 },
  istatistik: { alignItems: 'center' },
  sayi: { fontSize: 22, fontWeight: 'bold', color: '#2e8b57' },
  etiket: { color: '#88a090', fontSize: 13, marginTop: 4 },
  tamGenislikKutu: { backgroundColor: 'white', width: '90%', borderRadius: 20, padding: 20, elevation: 3, marginBottom: 15 },
  bolumBasligi: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  madalyaIcerik: { flexDirection: 'row', alignItems: 'center' },
  madalyaIkonKutusu: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  madalyaMetinAlani: { flex: 1 },
  madalyaAdi: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  madalyaAciklamasi: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 5 },
  toplamBagisYazisi: { fontSize: 12, color: '#888', fontWeight: 'bold' },
  gridKapsayici: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridOge: { width: '33.33%', padding: 5, aspectRatio: 1 },
  gridResim: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#eee' },
  postModalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  postKapatButon: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  postModalIcerik: { width: '100%', alignItems: 'center' },
  postModalResim: { width: '100%', height: 400 },
  postModalAltBar: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  postModalBegeniYazi: { color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
  cikisButon: { flexDirection: 'row', alignItems: 'center', padding: 10, marginTop: 10 },
  arkadasKutu: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, height: '85%' },
  sosyalSekmeler: { flexDirection: 'row', marginBottom: 15, borderBottomWidth: 1, borderColor: '#eee' },
  sosyalSekmeButon: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  sosyalSekmeAktif: { borderBottomWidth: 3, borderColor: '#2e8b57' },
  sosyalSekmeYazi: { fontSize: 16, fontWeight: 'bold', color: '#888' },
  arkadasEkleBar: { flexDirection: 'row', marginBottom: 20, marginTop: 10 },
  arkadasInput: { flex: 1, backgroundColor: '#f1f8e9', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#c8e6c9', marginRight: 10 },
  arkadasEkleButon: { backgroundColor: '#2e8b57', width: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  arkadasKart: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fbf9', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  arkadasAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  arkadasIsim: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  arkadasPuan: { fontSize: 12, color: '#666', marginTop: 3 },
  mesajButon: { backgroundColor: '#1b5e20', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sohbetEkrani: { flex: 1, backgroundColor: '#f5f8f5' },
  sohbetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#eee', elevation: 3 },
  sohbetAvatar: { width: 40, height: 40, borderRadius: 20 },
  sohbetIsim: { fontSize: 18, fontWeight: 'bold', color: '#1b5e20', flex: 1, marginLeft: 10 },
  mesajBalonu: { maxWidth: '80%', padding: 15, borderRadius: 20, marginBottom: 10 },
  benimMesajim: { alignSelf: 'flex-end', backgroundColor: '#2e8b57', borderBottomRightRadius: 5 },
  karsiMesaj: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderBottomLeftRadius: 5 },
  mesajYazi: { fontSize: 15, color: '#333' },
  emojiBarKapsayici: { backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 15, borderTopWidth: 1, borderColor: '#eee' },
  emojiButon: { paddingHorizontal: 10 },
  emojiText: { fontSize: 24 },
  sohbetInputBar: { flexDirection: 'row', padding: 15, backgroundColor: 'white', alignItems: 'flex-end' },
  sohbetInput: { flex: 1, backgroundColor: '#f1f8e9', padding: 15, borderRadius: 20, maxHeight: 100, minHeight: 50, marginRight: 10 },
  gonderButon: { backgroundColor: '#2e8b57', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  modalArkaPlan: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  cuzdanKutu: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, height: '70%' },
  odemeKutu: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, paddingBottom: 50, elevation: 15 },
  krediKartiGorsel: { backgroundColor: '#2e8b57', borderRadius: 20, padding: 25, marginBottom: 20, elevation: 5 },
  kartUzeriNo: { color: 'white', fontSize: 22, letterSpacing: 2, marginTop: 15, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  kartUzeriIsim: { color: 'white', fontSize: 14, letterSpacing: 1 },
  kartUzeriTarih: { color: 'white', fontSize: 14 },
  odemeOzet: { backgroundColor: '#f1f8e9', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#c8e6c9' },
  ozetYazi: { fontSize: 15, color: '#333', marginBottom: 5 },
  modalUstBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  cuzdanModalBaslik: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  altBaslik: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15, marginTop: 10 },
  paketGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  miniPaket: { backgroundColor: '#f1f8e9', width: '47%', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#c8e6c9' },
  miniPaketAdet: { fontSize: 24, fontWeight: 'bold', color: '#2e8b57' },
  miniPaketEtiket: { color: '#666', fontSize: 12 },
  fiyatEtiket: { backgroundColor: '#2e8b57', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10, marginTop: 8 },
  fiyatYazi: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  ozelMiktarKutusu: { marginTop: 20, backgroundColor: '#f9f9f9', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#eee' },
  ozelInputSatir: { flexDirection: 'row', marginTop: 10 },
  ozelInput: { flex: 1, backgroundColor: 'white', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#c8e6c9', fontSize: 16 },
  ozelAlButon: { backgroundColor: '#2e8b57', width: 60, marginLeft: 10, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  modalKutu: { backgroundColor: '#f1f8e9', padding: 30, borderRadius: 35, width: '92%', alignSelf: 'center', marginBottom: '20%', elevation: 10 },
  modalBaslik: { fontSize: 20, fontWeight: 'bold', color: '#1b5e20', marginBottom: 20, textAlign: 'center' },
  fotoDuzenleAlan: { position: 'relative', marginBottom: 25, alignSelf: 'center' },
  modalFoto: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ddd' },
  kameraIkon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2e8b57', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white' },
  input: { width: '100%', backgroundColor: 'white', padding: 18, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#c8e6c9', fontSize: 16 },
  kaydetButon: { backgroundColor: '#2e8b57', width: '100%', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 10, elevation: 3 },
  kaydetYazi: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});