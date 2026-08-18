import { supabase } from "../supabaseClient";

// Camada de dados: guarda cada "coleção" (consultas, pacientes, afazeres,
// estoque) como uma linha em app_state. Compartilhado entre todos os
// usuários autenticados — a mesma agenda para todo mundo autorizado.
export const store = {
  async get(key) {
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return { key, value: JSON.stringify(data.value) };
  },
  async set(key, value) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const { error } = await supabase
      .from("app_state")
      .upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};
