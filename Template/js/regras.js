// ===================== Utils =====================
function toNumberBR(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  s = s.replace(/\s/g, '').replace(/%/g, '');
  s = s.replace(/\./g, '');     // milhar
  s = s.replace(/,/g, '.');     // decimal
  s = s.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function normStr(v) { return (v ?? '').toString().trim().toLowerCase(); }
function normSindicatoName(s) { return normStr(s).replace(/[\s\-_/]+/g, ''); }
function approx(a, b, eps = 0.02) { // tolerância pra 2, 3.6, 6
  const na = toNumberBR(a), nb = toNumberBR(b);
  return Number.isFinite(na) && Math.abs(na - nb) <= eps;
}

// ===================== De-para =====================
export function dePara(baseOperadora, baseDados) {
  return baseOperadora.map((rOp) => {
    const cnpjTitular = rOp['CPF/CNPJ Titular'];
    const cnpjTitularString = cnpjTitular ? cnpjTitular.toString().replace(/[^\d]+/g, '') : '';
    if (!cnpjTitularString) {
      rOp['SUB-ESTIPULANTE'] = 'Não Encontrado';
      rOp['Consultor'] = 'Não Encontrado';
      return rOp;
    }

    const correspondente = baseDados.find((rBase) => {
      const cnpjBase = rBase['CNPJ'];
      const cnpjBaseString = cnpjBase ? cnpjBase.toString().replace(/[^\d]+/g, '') : '';
      return cnpjBaseString === cnpjTitularString;
    });

    if (correspondente) {
      rOp['SUB-ESTIPULANTE'] = correspondente['SUB-ESTIPULANTE'] ?? correspondente['Substipulante'] ?? 'Não Encontrado';
      rOp['Consultor'] = correspondente['CONSULTOR'] ?? correspondente['Consultor'] ?? 'Não Encontrado';
      if (correspondente['Percentual'] !== undefined) rOp['Percentual'] = correspondente['Percentual']; // se existir na base
    } else {
      rOp['SUB-ESTIPULANTE'] = 'Não Encontrado';
      rOp['Consultor'] = 'Não Encontrado';
    }
    return rOp;
  });
}

// ===================== Filtro =====================
export function filtrarResultados(dados) {
  return dados.filter(r => r['SUB-ESTIPULANTE'] !== 'Não Encontrado' && r['Consultor'] !== 'Não Encontrado');
}

// ===================== Regras Sindicato =====================
const regrasSindicato = [ { sindicato: "ACE-BSI", indice: "13,28%" }, { sindicato: "ASTIC", indice: "13,28%" }, { sindicato: "FETRACONMAG", indice: "13,28%" }, { sindicato: "SINDICOMERCIÁRIOS", indice: "13,28%" }, { sindicato: "SINDIMETAL", indice: "13,28%" }, { sindicato: "SINDUSCON", indice: "13,28%" }, { sindicato: "SINERGIA", indice: "13,28%" }, { sindicato: "SINTRACONST", indice: "13,28%" }, { sindicato: "SINTRAFARMA", indice: "13,28%" }, { sindicato: "ABEEPP", indice: "46,51%" }, { sindicato: "ABES", indice: "46,51%" }, { sindicato: "ABOES", indice: "46,51%" }, { sindicato: "ADEPOL", indice: "46,51%" }, { sindicato: "ASPROLI", indice: "46,51%" }, { sindicato: "ASSEMES", indice: "46,51%" }, { sindicato: "CAEBS", indice: "46,51%" }, { sindicato: "CRC ES", indice: "46,51%" }, { sindicato: "CRF ES", indice: "46,51%" }, { sindicato: "FETRACS", indice: "46,51%" }, { sindicato: "OAB ES", indice: "46,51%" }, { sindicato: "SENALBA", indice: "46,51%" }, { sindicato: "SINDEPRES", indice: "46,51%" }, { sindicato: "SINDIENFERMEIROS", indice: "46,51%" }, { sindicato: "SINDILIMPE", indice: "46,51%" }, { sindicato: "SINDLATICINIOS", indice: "46,51%" }, { sindicato: "SINDMOMMES", indice: "46,51%" }, { sindicato: "SINDTRAGES", indice: "46,51%" }, { sindicato: "SINEPE", indice: "46,51%" }, { sindicato: "SINTRACICAL", indice: "46,51%" }, { sindicato: "SINTRACON", indice: "46,51%" }, { sindicato: "SINTRAMASSAS", indice: "46,51%" } ];

const mapaSindicato = new Map(
  regrasSindicato.map(r => [normSindicatoName(r.sindicato), toNumberBR(r.indice) / 100])
);

// Ex.: "ACE BSI-COMP-..." -> "acebsi"
function inferirSindicatoPeloGrupo(grupoGerencial) {
  const g = (grupoGerencial ?? '').toString();
  const prefix = g.split('-')[0];
  if (!prefix) return null;
  const chave = normSindicatoName(prefix);
  return mapaSindicato.has(chave) ? chave : null;
}

export function getPercentualSindicato(substipulante, dadosBaseOperadora, grupoGerencial) {
  // 1) tabela fixa
  let chave = normSindicatoName(substipulante);
  if (mapaSindicato.has(chave)) return mapaSindicato.get(chave);

  // 2) grupo gerencial
  const inf = inferirSindicatoPeloGrupo(grupoGerencial);
  if (inf && mapaSindicato.has(inf)) return mapaSindicato.get(inf);

  // 3) procurar coluna Percentual na base
  const subNorm = normStr(substipulante);
  const encontrado = dadosBaseOperadora.find(
    (r) => normStr(r['SUB-ESTIPULANTE']) === subNorm && r['Percentual'] !== undefined
  );
  if (encontrado) {
    const p = toNumberBR(encontrado['Percentual']);
    if (Number.isFinite(p)) return p / 100;
  }

  // 4) fallback neutro
  return 1;
}

// ===================== AGRUPAR + CÁLCULO =====================
// buckets que correspondem às colunas do seu print
function bucketize(row) {
  const func = normStr(row['Função'] ?? row['Tipo Produto'] ?? row['Tipo de Produto']);
  const pct = toNumberBR(row['Percentual']); // 2, 3,6, 6...
  const valor = toNumberBR(row['Valor']);
  if (!Number.isFinite(valor)) return { bucket: null, valor: 0 };

  // Agenciamento explícito
  if (func.includes('agenc')) return { bucket: 'agenciamento', valor };

  // Vitalício líder percentual 6
  if (func.includes('líder') && approx(pct, 6)) return { bucket: 'vitalicio_lider_6', valor };

  // Vitalício percentual 6
  if (func.includes('vital') && approx(pct, 6)) return { bucket: 'vitalicio_6', valor };

  // Vitalício sobre Movimentação 3,6
  if (func.includes('mov') && approx(pct, 3.6)) return { bucket: 'vitalicio_mov_36', valor };

  // Vitalício 3,6
  if (func.includes('vital') && approx(pct, 3.6)) return { bucket: 'vitalicio_36', valor };

  // Vitalício sobre Movimentação 2
  if (func.includes('mov') && approx(pct, 2)) return { bucket: 'vitalicio_mov_2', valor };

  // Vitalício 2
  if (func.includes('vital')) return { bucket: 'vitalicio_2', valor };

  // desconhecido -> soma no “vitalício” padrão
  return { bucket: 'vitalicio_2', valor };
}

// Função principal pedida
export function agruparECalcular(dados, dadosBaseOperadora) {
  const grupos = new Map();

  for (const r of dados) {
    const chave = (r['CPF/CNPJ Titular'] ?? '').toString();
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        'CPF/CNPJ Titular': r['CPF/CNPJ Titular'],
        'Nome/Empresa Titular': r['Nome/Empresa Titular'],
        'SUB-ESTIPULANTE': r['SUB-ESTIPULANTE'],
        'Consultor': r['Consultor'],
        'Grupo gerencial': r['Grupo gerencial'],
        // buckets numéricos
        vitalicio_lider_6: 0,
        vitalicio_6: 0,
        vitalicio_mov_36: 0,
        vitalicio_36: 0,
        vitalicio_mov_2: 0,
        vitalicio_2: 0,
        agenciamento: 0, // “50 Agenciamento”
      });
    }
    const g = grupos.get(chave);
    const { bucket, valor } = bucketize(r);
    if (bucket) g[bucket] += valor;
  }

  // aplica fórmula final e percentual do sindicato
  const saida = [];
  for (const g of grupos.values()) {
    const pctSind = getPercentualSindicato(g['SUB-ESTIPULANTE'], dadosBaseOperadora, g['Grupo gerencial']);
    const soma =
      g.vitalicio_2 +
      g.vitalicio_mov_2 +
      g.vitalicio_36 +
      g.vitalicio_mov_36 +
      (g.vitalicio_6 / 2) +
      (g.vitalicio_lider_6 / 2) +
      g.agenciamento;

    const valorFinal = Math.round(soma * (Number.isFinite(pctSind) ? pctSind : 1));

    saida.push({
      'CPF/CNPJ Titular': g['CPF/CNPJ Titular'],
      'Nome/Empresa Titular': g['Nome/Empresa Titular'],
      'SUB-ESTIPULANTE': g['SUB-ESTIPULANTE'],
      'Consultor': g['Consultor'],
      // espelhos das colunas do print
      'Vitalício Líder': g.vitalicio_lider_6,
      'Vitalício': g.vitalicio_2,
      'Vitalício sobre Movimentação': g.vitalicio_mov_2,
      'Vitalício (3,6)': g.vitalicio_36,
      'Vitalício sobre Movimentação (3,6)': g.vitalicio_mov_36,
      'Vitalício (6)': g.vitalicio_6,
      'Vitalício Líder (6)': g.vitalicio_lider_6, // mantido para referência
      'Agenciamento': g.agenciamento,
      'Percentual Sindicato': pctSind, // ex.: 0.4651
      'Valor Calculado': valorFinal,
    });
  }

  return saida;
}
