// Firebase project configuration.
// Copy the config object from Firebase console > Project settings > Your apps > Web app.
//
// To develop without touching a real project, run `npm run emulators` in a second terminal
// and leave `useEmulators` true — the app will talk to the local Auth/Firestore emulators
// and the placeholder keys below are enough.
export const environment = {
  production: false,
  useEmulators: true,
  firebase: {
    apiKey: 'demo-key',
    authDomain: 'demo-doctorq.firebaseapp.com',
    projectId: 'demo-doctorq',
    storageBucket: 'demo-doctorq.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
};
