// Initialize Lucide icons
lucide.createIcons();

// State management
const state = {
    currentSection: 'overview',
    data: {
        summary: {},
        emailPerf: [],
        contacts: [],
        metaAds: []
    },
    charts: {}
};

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');
const sectionTitle = document.getElementById('section-title');
const sectionSubtitle = document.getElementById('section-subtitle');

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = item.getAttribute('href').substring(1);
        switchSection(targetSection);
    });
});

function switchSection(sectionId) {
    state.currentSection = sectionId;
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('href') === `#${sectionId}`);
    });
    sections.forEach(section => {
        section.classList.toggle('active', section.id === `section-${sectionId}`);
    });

    const s = state.data.summary;
    if (sectionId === 'overview') {
        sectionTitle.textContent = s['Evento'] || 'Dashboard de Acompanhamento';
        sectionSubtitle.textContent = s['Data'] || 'Visão geral do evento.';
        renderCharts();
    } else {
        const tabNames = {
            'meta-ads': 'Análise de Mídia (Meta Ads)',
            'email-perf': 'Desempenho de Disparos',
            'contacts': 'Base Operacional'
        };
        sectionTitle.textContent = tabNames[sectionId] || 'Detalhes';
        sectionSubtitle.textContent = `Listagem completa e métricas de ${sectionId}.`;
        updateTables(sectionId);
    }
}

// --- Data Loading & Parsing ---
async function fetchData() {
    const dataFiles = {
        summary: 'data/dashboard_evento.csv',
        emailPerf: 'data/lp_conversoes_clientes+leads.xlsx - BASE LEADS RS.csv',
        contacts: 'data/mensagens_chatobot+disparo.xlsx - DISPARO.csv',
        metaAds: 'data/meta_ads_2003.csv'
    };

    const promises = Object.entries(dataFiles).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            const csvText = await response.text();
            
            return new Promise((resolve) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (key === 'summary') {
                            const summaryObj = {};
                            results.data.forEach(row => {
                                if (row.Descricao) summaryObj[row.Descricao.trim()] = row.Valor;
                            });
                            state.data.summary = summaryObj;
                        } else {
                            state.data[key] = results.data;
                        }
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.warn(`Erro ao carregar ${path}.`, error);
            return Promise.resolve();
        }
    });

    await Promise.all(promises);
    processAndDisplayData();
    document.getElementById('last-update').textContent = `Dados: ${state.data.summary['Ultima Atualizacao'] || 'Atualizados'}`;
}

function processAndDisplayData() {
    updateKPIs();
    renderCharts();
}

function updateKPIs() {
    const s = state.data.summary;
    
    const valLeads = s['leads atuais'] || state.data.contacts.length || 0;
    const valSales = s['Ingressos Aprovados'] || 0;
    
    // Aggregating investment from Meta Ads file if summary is empty
    let totalMetaSpend = state.data.metaAds.reduce((sum, row) => sum + (parseFloat(row['Valor usado (BRL)']) || 0), 0);
    const valInvest = s['investimento atual'] || totalMetaSpend;
    
    const totalEmailProcessed = state.data.emailPerf.reduce((sum, row) => sum + (parseInt(row['Processados']) || 0), 0);

    document.getElementById('kpi-leads').textContent = valLeads.toLocaleString();
    document.getElementById('kpi-sales').textContent = valSales.toLocaleString();
    document.getElementById('kpi-invest').textContent = typeof valInvest === 'number' 
        ? `R$ ${valInvest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : valInvest;
    document.getElementById('kpi-msgs').textContent = (totalEmailProcessed + state.data.contacts.length).toLocaleString();

    if (s['Evento']) {
        sectionTitle.textContent = s['Evento'];
        sectionSubtitle.textContent = s['Data'] || '';
        document.getElementById('header-date').textContent = s['Data'] || 'Evento 2026';
    }
}

function renderCharts() {
    renderConversionsChart();
    renderSourceDistributionChart();
}

function renderConversionsChart() {
    const canvas = document.getElementById('conversionsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.conversions) state.charts.conversions.destroy();

    const metaByDate = {};
    state.data.metaAds.forEach(row => {
        const date = row['Início dos relatórios'];
        if (!date) return;
        const leads = parseInt(row['Leads']) || 0;
        metaByDate[date] = (metaByDate[date] || 0) + leads;
    });

    const dates = Object.keys(metaByDate).sort();
    const metaValues = dates.map(d => metaByDate[d]);

    state.charts.conversions = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => d.split('-').reverse().slice(0, 2).join('/')),
            datasets: [{
                label: 'Leads Meta Ads',
                data: metaValues,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.5)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderSourceDistributionChart() {
    const canvas = document.getElementById('sourceDistributionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.source) state.charts.source.destroy();

    const tagCounts = {};
    state.data.contacts.forEach(row => {
        const tagLine = row['Tags'] || 'Sem Tag';
        const tags = tagLine.split(';').map(t => t.trim());
        tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    const labels = Object.keys(tagCounts);
    const values = Object.values(tagCounts);

    state.charts.source = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#6366f1', '#14b8a6', '#0ea5e9', '#d946ef', '#f59e0b', '#ec4899', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: 'Outfit', size: 10 } } }
            }
        }
    });
}

function updateTables(sectionId) {
    if (sectionId === 'meta-ads') {
        const tbody = document.querySelector('#table-meta tbody');
        if (!tbody) return;
        tbody.innerHTML = state.data.metaAds.slice(0, 15).map(row => `
            <tr>
                <td>${row['Nome do anúncio'] || '-'}</td>
                <td>R$ ${(row['Valor usado (BRL)'] || 0).toLocaleString('pt-BR')}</td>
                <td>${row['Leads'] || 0}</td>
                <td>${row['Custo por lead (BRL)'] || '-'}</td>
                <td>${row['Cliques no link'] || 0}</td>
            </tr>
        `).join('');
    } else if (sectionId === 'email-perf') {
        const tbody = document.querySelector('#table-emails tbody');
        if (!tbody) return;
        tbody.innerHTML = state.data.emailPerf.map(row => `
            <tr>
                <td>${row['YouRH Summit Porto Alegre - BASE LEADS AGENDADOS RS'] || 'Email'}</td>
                <td>${row['Processados']}</td>
                <td>${row['Abertos']}</td>
                <td>${row['Bounce']}</td>
                <td>${row['Taxa de abertura']}%</td>
            </tr>
        `).join('');
    } else if (sectionId === 'contacts') {
        const tbody = document.querySelector('#table-contacts tbody');
        if (!tbody) return;
        tbody.innerHTML = state.data.contacts.slice(0, 30).map(row => `
            <tr>
                <td>${row['Cliente']}</td>
                <td>${row['Email']}</td>
                <td>${row['Tags']}</td>
                <td>${row['Registro em']}</td>
                <td>${row['Canal']}</td>
            </tr>
        `).join('');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    switchSection('overview');
});
