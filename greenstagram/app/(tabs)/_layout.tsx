import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function TabLayout() {
  const [oturumAcikMi, setOturumAcikMi] = useState(false);
  const [baslangicYuklemesi, setBaslangicYuklemesi] = useState(true);

  const [kayitModu, setKayitModu] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [email, setEmail] = useState('');
  const [nick, setNick] = useState('');
  const [sifre, setSifre] = useState('');

  const [beniHatirla, setBeniHatirla] = useState(false);

  useEffect(() => {
    const hafizayiKontrolEt = async () => {
      try {
        const kayitliNick = await AsyncStorage.getItem('kayitliNick');
        const kayitliSifre = await AsyncStorage.getItem('kayitliSifre');
        if (kayitliNick && kayitliSifre) {
          setNick(kayitliNick);
          setSifre(kayitliSifre);
          setBeniHatirla(true);
        }
      } catch (e) {
        console.log("Hafıza okuma hatası");
      }
    };
    
    hafizayiKontrolEt();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'kullanicilar', user.uid));
        
        if (userDoc.exists() && userDoc.data().durum === 'yasakli') {
          Alert.alert("Erişim Engellendi", "Hesabınız kurallara aykırı davranıştan dolayı yasaklanmıştır.");
          await signOut(auth);
          setOturumAcikMi(false);
        } else {
          setOturumAcikMi(true);
        }
      } else {
        setOturumAcikMi(false);
      }
      setBaslangicYuklemesi(false);
    });
    return unsubscribe;
  }, []);

  const girisYap = async () => {
    if (!nick || !sifre) return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    setYukleniyor(true);

    try {
      const q = query(collection(db, 'kullanicilar'), where('kullaniciAdi', '==', nick.toLowerCase().trim()));
      const sorguSonucu = await getDocs(q);

      if (sorguSonucu.empty) {
        setYukleniyor(false);
        return Alert.alert("Hata", "Bu kullanıcı adına sahip bir hesap bulunamadı.");
      }

      const gercekEmail = sorguSonucu.docs[0].data().email;
      await signInWithEmailAndPassword(auth, gercekEmail, sifre);
      
      if (beniHatirla) {
        await AsyncStorage.setItem('kayitliNick', nick);
        await AsyncStorage.setItem('kayitliSifre', sifre);
      } else {
        await AsyncStorage.removeItem('kayitliNick');
        await AsyncStorage.removeItem('kayitliSifre');
      }
      
    } catch (error: any) {
      // SADECE BURAYI DEĞİŞTİRDİM: Eğer girmezse Firebase'in gerçek hatasını göstersin
      Alert.alert("Giriş Başarısız", error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  const kayitOl = async () => {
    if (!email || !nick || !sifre) return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    if (sifre.length < 6) return Alert.alert("Hata", "Şifre en az 6 karakter olmalı.");
    setYukleniyor(true);

    try {
      const q = query(collection(db, 'kullanicilar'), where('kullaniciAdi', '==', nick.toLowerCase().trim()));
      const sorguSonucu = await getDocs(q);

      if (!sorguSonucu.empty) {
        setYukleniyor(false);
        return Alert.alert("Hata", "Bu kullanıcı adı zaten alınmış!");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), sifre);
      const user = userCredential.user;

      await setDoc(doc(db, 'kullanicilar', user.uid), {
        kullaniciAdi: nick.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        biyografi: "Doğa dostu bir fidan bağışçısı 🌿",
        profilFoto: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=200&q=80",
        fidanSayisi: 0,
        puan: 0,
        bakiye: 0,
        toplamBagis: 0, 
        rol: "kullanici" 
      });

      if (beniHatirla) {
        await AsyncStorage.setItem('kayitliNick', nick);
        await AsyncStorage.setItem('kayitliSifre', sifre);
      }

    } catch (error: any) {
      // SADECE BURAYI DEĞİŞTİRDİM: Firebase'in asıl hatasını bassın
      Alert.alert("Kayıt Hatası", error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  if (baslangicYuklemesi) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f8e9'}}>
        <ActivityIndicator size="large" color="#2e8b57" />
      </View>
    );
  }

  if (!oturumAcikMi) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.formKutusu}>
          <View style={styles.ustAlan}>
            <Ionicons name="leaf" size={60} color="#2e8b57" />
            <Text style={styles.baslik}>Greenstagram</Text>
            <Text style={styles.altBaslik}>{kayitModu ? 'Doğaya Katıl' : 'Tekrar Hoş Geldin'}</Text>
          </View>

          <View style={styles.inputGrubu}>
            {kayitModu && (
              <View style={styles.inputKapsayici}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.ikon} />
                <TextInput style={styles.input} placeholder="E-posta Adresi" value={email} onChangeText={setEmail} autoCapitalize="none" />
              </View>
            )}

            <View style={styles.inputKapsayici}>
              <Ionicons name="at-outline" size={20} color="#666" style={styles.ikon} />
              <TextInput style={styles.input} placeholder="Kullanıcı Adı (Nick)" value={nick} onChangeText={setNick} autoCapitalize="none" />
            </View>

            <View style={styles.inputKapsayici}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.ikon} />
              <TextInput style={styles.input} placeholder="Şifre" value={sifre} onChangeText={setSifre} secureTextEntry />
            </View>

            <TouchableOpacity style={styles.hatirlaKutusu} onPress={() => setBeniHatirla(!beniHatirla)}>
              <Ionicons name={beniHatirla ? "checkbox" : "square-outline"} size={22} color="#2e8b57" />
              <Text style={styles.hatirlaYazi}>Beni Hatırla</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.anaButon} onPress={kayitModu ? kayitOl : girisYap} disabled={yukleniyor}>
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text style={styles.anaButonYazi}>{kayitModu ? 'Hesap Oluştur' : 'Giriş Yap'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setKayitModu(!kayitModu)} style={styles.modDegistir}>
            <Text style={styles.modDegistirYazi}>{kayitModu ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#2e8b57',
      headerShown: false,
      tabBarStyle: { backgroundColor: 'white', elevation: 10, minHeight: 70, paddingBottom: Platform.OS === 'android' ? 15 : 25, paddingTop: 10 }
    }}>
      <Tabs.Screen name="index" options={{ title: 'Harita', tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />, }} />
      <Tabs.Screen name="explore" options={{ title: 'Keşfet', tabBarIcon: ({ color }) => <Ionicons name="compass" size={24} color={color} />, }} />
      <Tabs.Screen name="shop" options={{ title: 'Mağaza', tabBarIcon: ({ color }) => <Ionicons name="cart" size={24} color={color} />, }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />, }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f8e9', justifyContent: 'center', alignItems: 'center' },
  formKutusu: { width: '85%', alignItems: 'center' },
  ustAlan: { alignItems: 'center', marginBottom: 40 },
  baslik: { fontSize: 32, fontWeight: 'bold', color: '#1b5e20', marginTop: 10 },
  altBaslik: { color: '#666', fontSize: 16, marginTop: 5 },
  inputGrubu: { width: '100%', marginBottom: 20 },
  inputKapsayici: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 15, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#c8e6c9', height: 55 },
  ikon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  hatirlaKutusu: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: 5, marginBottom: 15 },
  hatirlaYazi: { marginLeft: 8, fontSize: 15, color: '#555', fontWeight: 'bold' },
  anaButon: { backgroundColor: '#2e8b57', width: '100%', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  anaButonYazi: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  modDegistir: { marginTop: 20 },
  modDegistirYazi: { color: '#2e8b57', fontWeight: '600' }
});