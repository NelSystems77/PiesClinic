import { create } from 'zustand';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Usuario } from '../types';

interface AuthState {
  firebaseUser: User | null;
  usuario: Usuario | null;
  isLoading: boolean;
  esAdmin: boolean;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  usuario: null,
  isLoading: true,
  esAdmin: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({ firebaseUser: null, usuario: null, isLoading: false, esAdmin: false });
        return;
      }

      try {
        const q = query(
          collection(db, 'usuarios'),
          where('email', '==', firebaseUser.email!.toLowerCase())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const usuario = { id: snap.docs[0].id, ...snap.docs[0].data() } as Usuario;
          const esAdmin = usuario.rol === 'admin' || usuario.rol === 'superadmin';
          set({ firebaseUser, usuario, isLoading: false, esAdmin });
        } else {
          set({ firebaseUser, usuario: null, isLoading: false, esAdmin: false });
        }
      } catch {
        set({ firebaseUser, usuario: null, isLoading: false, esAdmin: false });
      }
    });

    return unsubscribe;
  },
}));
