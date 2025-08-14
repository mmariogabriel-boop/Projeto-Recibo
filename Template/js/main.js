// main.js
// ⬇️ Removido aplicarRegras do import
import { dePara, filtrarResultados, agruparECalcular } from './regras.js';

document.addEventListener('DOMContentLoaded', function () {
  class CarregaRegra {
    constructor() {
      this.arquivoinput = document.getElementById('arquivoinput');
      this.baseInput = document.getElementById('baseInput');
      this.carregaRestorno = document.getElementById('carregaRestorno');
      this.operadoraSelect = document.getElementById('OperadorasEsc');
      this.loader = document.getElementById('loader');

      this.dadosBaseOperadora = [];
      this.dadosBase = [];
    }

    async base() {
      if (!this.arquivoinput.files.length || !this.baseInput.files.length) {
        alert('Por favor, adicione o arquivo da operadora e o arquivo da base.');
        return;
      }

      if (this.loader) this.loader.style.display = 'block';

      try {
        const arquivo = this.arquivoinput.files[0];
        const operadoraSelecionada = this.operadoraSelect.value;
        let nomeOperadora = '';

        switch (operadoraSelecionada) {
          case '1': nomeOperadora = 'Up Health'; break;
          case '2': nomeOperadora = 'Mediatorie'; break;
          case '3': nomeOperadora = 'Samp'; break;
          default:
            alert('Selecione uma operadora válida.');
            return;
        }

        this.carregaRestorno.textContent =
          `O arquivo da operadora "${nomeOperadora}" foi carregado.\n\nIniciando processamento...`;

        // 1) Lê as planilhas
        const dadosOperadora = await this.lerPlanilhaUsuario(arquivo);
        const arquivoBase = this.baseInput.files[0];
        const dadosBase = await this.lerPlanilhaUsuario(arquivoBase);
        this.dadosBase = dadosBase;

        // 2) De-para
        const dadosAtualizados = dePara(dadosOperadora, dadosBase);
        this.dadosBaseOperadora = dadosAtualizados;

        // 3) Filtra apenas registros encontrados
        const dadosFiltrados = filtrarResultados(dadosAtualizados);

        // 4) AGRUPAR + fórmula final (substitui calcularValores)
        const resultados = agruparECalcular(dadosFiltrados, this.dadosBaseOperadora);

        // 5) Exibir e exportar
        this.carregaRestorno.textContent += `\nCálculos aplicados com sucesso. ${resultados.length} titulares processados.`;
        this.exibirTabela(resultados);
        this.gerarExcel(resultados);

        console.log(resultados);
      } catch (err) {
        console.error(err);
        alert('Ocorreu um erro ao processar os arquivos. Verifique os dados e tente novamente.');
      } finally {
        if (this.loader) this.loader.style.display = 'none';
      }
    }

    exibirTabela(dados) {
      const tbody = document.getElementById('resultadosTabela').getElementsByTagName('tbody')[0];
      tbody.innerHTML = '';

      dados.forEach((registro) => {
        const tr = tbody.insertRow();
        tr.insertCell(0).textContent = registro['CPF/CNPJ Titular'] ?? '';
        tr.insertCell(1).textContent = registro['SUB-ESTIPULANTE'] ?? '';
        tr.insertCell(2).textContent = registro['Consultor'] ?? '';
        tr.insertCell(3).textContent = '—';
        const v = Number(registro['Valor Calculado']) || 0;
        tr.insertCell(4).textContent = v.toLocaleString('pt-BR');
      });
    }

    gerarExcel(dados) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, 'Registros Processados');
      XLSX.writeFile(wb, 'dados_processados.xlsx');
    }

    async lerPlanilhaUsuario(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const aba = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(aba);
            resolve(json);
          } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }
  }

  // Disponibiliza a função no escopo global (para o onclick do HTML)
  window.CarregaRetornoHeat = function () {
    const regra = new CarregaRegra();
    regra.base();
  };
});
