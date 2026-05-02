-- ============================================================
-- CAMINHO DO DENDÊ · Schema Supabase
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- ============================================================

-- 1. Perfis de clientes (criado automaticamente ao registrar)
CREATE TABLE IF NOT EXISTS perfis (
  id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  created_at timestamptz DEFAULT now()
);

-- 2. Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid    REFERENCES auth.users(id),
  nome_cliente   text    NOT NULL,
  rua            text    NOT NULL,
  numero         text    NOT NULL,
  bairro         text    NOT NULL,
  pagamento      text    NOT NULL,
  troco          text,
  items          jsonb   NOT NULL,
  subtotal       numeric NOT NULL,
  pontos_ganhos  int     NOT NULL DEFAULT 0,
  status         text    NOT NULL DEFAULT 'novo',
  created_at     timestamptz DEFAULT now()
);

-- 3. Movimentações de fidelidade
CREATE TABLE IF NOT EXISTS fidelidade (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pedido_id  uuid    REFERENCES pedidos(id),
  pontos     int     NOT NULL,
  tipo       text    NOT NULL DEFAULT 'ganho',  -- 'ganho' | 'resgatado'
  descricao  text,
  created_at timestamptz DEFAULT now()
);

-- 4. View: saldo total de pontos por usuário
CREATE OR REPLACE VIEW total_pontos AS
  SELECT user_id, COALESCE(SUM(pontos), 0) AS saldo
  FROM fidelidade
  GROUP BY user_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE perfis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade ENABLE ROW LEVEL SECURITY;

-- Perfis
CREATE POLICY "perfis_own" ON perfis FOR ALL USING (auth.uid() = id);

-- Pedidos: usuário logado vê/insere os seus; anônimo pode inserir (user_id NULL)
CREATE POLICY "pedidos_select_own"    ON pedidos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pedidos_insert_auth"   ON pedidos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pedidos_insert_anon"   ON pedidos FOR INSERT WITH CHECK (user_id IS NULL);

-- Fidelidade: usuário vê os seus; o trigger (SECURITY DEFINER) insere
CREATE POLICY "fidelidade_select_own" ON fidelidade FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fidelidade_insert_sys" ON fidelidade FOR INSERT WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger 1: criar perfil ao registrar usuário
CREATE OR REPLACE FUNCTION criar_perfil()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO perfis (id, nome)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_perfil();

-- Trigger 2: registrar pontos de fidelidade ao inserir pedido com user_id
CREATE OR REPLACE FUNCTION registrar_pontos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.pontos_ganhos > 0 THEN
    INSERT INTO fidelidade (user_id, pedido_id, pontos, descricao)
    VALUES (NEW.user_id, NEW.id, NEW.pontos_ganhos, 'Pedido ' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pedido_inserted ON pedidos;
CREATE TRIGGER on_pedido_inserted
  AFTER INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION registrar_pontos();
