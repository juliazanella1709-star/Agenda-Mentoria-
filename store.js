import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Guarda cada coleção (consultas, pacientes, afazeres, estoque) como um
// documento na coleção app_state. Compartilhado entre todos os usuários
// autenticados -> a mesma agenda para todo mundo autorizado.
const idOf = (key) => key.replace(/\//g, "_");

export const store = {
  async get(key) {
    const snap = await getDoc(doc(db, "app_state", idOf(key)));
    if (!snap.exists()) return null;
    return { key, value: JSON.stringify(snap.data().value) };
  },
  async set(key, value) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    await setDoc(doc(db, "app_state", idOf(key)), { value: parsed, updatedAt: Date.now() });
    return { key, value };
  },
};
