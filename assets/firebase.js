// ---------------------------------------------------------------
// Firebase — inicialização compartilhada (Authentication + Firestore)
// Este arquivo é um ES module (carregado com <script type="module">),
// então ele NÃO compartilha escopo com cart.js/menu.js automaticamente.
// Por isso expomos tudo que as outras páginas precisam em `window.largo*`.
// ---------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// A apiKey abaixo é pública por natureza no Firebase (fica exposta no
// front-end de qualquer app Firebase) — quem protege os dados são as
// REGRAS do Firestore (Firestore Rules), não o sigilo dessa chave.
const firebaseConfig = {
  apiKey: "AIzaSyB09RXQyn0xSxY6HDi7JHNDdopn5Ok-Avk",
  authDomain: "largo-loja.firebaseapp.com",
  projectId: "largo-loja",
  storageBucket: "largo-loja.firebasestorage.app",
  messagingSenderId: "492620543168",
  appId: "1:492620543168:web:83c8fb0531ddd06e0e6925",
  measurementId: "G-SRZ1G445XP",
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

window.largoCurrentUser = null;

// --- Authentication -------------------------------------------------

window.largoSignUp = async function (name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  return cred.user;
};

window.largoSignIn = async function (email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

window.largoSignInWithGoogle = async function () {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
};

window.largoSignOut = function () {
  return signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  window.largoCurrentUser = user;
  document.dispatchEvent(new CustomEvent("largo-auth-changed", { detail: { user } }));
});

// --- Firestore: pedidos ----------------------------------------------

// Salva um pedido finalizado. Chamada depois que o pagamento é
// confirmado (ver checkout.html).
window.largoSaveOrder = async function (order) {
  const docRef = await addDoc(collection(db, "pedidos"), {
    uid: window.largoCurrentUser ? window.largoCurrentUser.uid : null,
    email: window.largoCurrentUser ? window.largoCurrentUser.email : order.email || null,
    items: order.items,
    total: order.total,
    status: order.status || "pendente",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// Busca os pedidos do usuário logado, mais recentes primeiro.
window.largoGetOrders = async function (uid) {
  const q = query(collection(db, "pedidos"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
