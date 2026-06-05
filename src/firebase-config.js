// ══════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN FIREBASE
// ══════════════════════════════════════════════════════════════════════════════

const AUTH_EMAIL = 'npavoni10@gmail.com';

// Configuración del proyecto Firebase
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCld2jtUO2smhN7bQySyO8Afc7qSHrATe8',
  authDomain:        'market-dashboard-b7a14.firebaseapp.com',
  databaseURL:       'https://market-dashboard-b7a14-default-rtdb.firebaseio.com',
  projectId:         'market-dashboard-b7a14',
  storageBucket:     'market-dashboard-b7a14.firebasestorage.app',
  messagingSenderId: '508913419368',
  appId:             '1:508913419368:web:57a817599e77693f2f27dd',
};

firebase.initializeApp(FIREBASE_CONFIG);
