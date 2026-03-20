// Initialize Lucide icons
lucide.createIcons();

// State management
const state = {
    currentSection: 'overview',
    data: {
        summary: {},
        emailPerf: [],
        contacts: [],
        metaAds: [],
        sympla: []
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
            'meta-ads': 'Meta Ads | Performance de Mídia',
            'sympla': 'Sympla | Gestão de Ingressos',
            'email-perf': 'Email | Performance de Disparos',
            'whatsapp': 'WhatsApp | Base de Envio',
            'contacts': 'Base Geral | Todos os Contatos'
        };
        sectionTitle.textContent = tabNames[sectionId] || 'Detalhes';
        sectionSubtitle.textContent = `Indicadores e métricas detalhadas de ${sectionId}.`;
        updateTables(sectionId);
    }
}

// --- Data Loading & Parsing ---
async function fetchData() {
    const dataFiles = {
        summary: 'data/dashboard_evento.csv',
        emailPerf: 'data/lp_conversoes_clientes+leads.xlsx - BASE LEADS RS.csv',
        contacts: 'data/mensagens_chatobot+disparo.xlsx - DISPARO.csv',
        metaAds: 'data/meta_ads_2003.csv',
        sympla: 'data/sympla.csv'
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
    
    // Total Leads and Views
    const totalViews = state.data.metaAds.reduce((sum, row) => sum + (parseInt(row['Visualizações da página de destino do site']) || 0), 0);
    const paidSales = state.data.sympla.filter(row => row.Status === 'Pago').length || s['Ingressos Aprovados'] || 0;
    
    let totalMetaSpend = state.data.metaAds.reduce((sum, row) => sum + (parseFloat(row['Valor usado (BRL)']) || 0), 0);
    const valInvest = s['investimento atual'] || totalMetaSpend;
    
    const totalContacts = state.data.contacts.length;

    document.getElementById('kpi-leads').textContent = (s['leads atuais'] || totalContacts).toLocaleString();
    document.getElementById('kpi-sales').textContent = paidSales.toLocaleString();
    document.getElementById('kpi-views').textContent = totalViews.toLocaleString();
    document.getElementById('kpi-msgs').textContent = totalContacts.toLocaleString();

    if (s['Evento']) {
        sectionTitle.textContent = s['Evento'];
        sectionSubtitle.textContent = s['Data'] || '';
        document.getElementById('header-date').textContent = s['Data'] || 'Evento 2026';
    }
}

function renderCharts() {
    renderViewsChart();
    renderSourceDistributionChart();
}

function renderViewsChart() {
    const canvas = document.getElementById('conversionsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.conversions) state.charts.conversions.destroy();

    // Grouping by date for Landing Page Views
    const viewsByDate = {};
    state.data.metaAds.forEach(row => {
        const date = row['Início dos relatórios'];
        if (!date) return;
        const views = parseInt(row['Visualizações da página de destino do site']) || 0;
        viewsByDate[date] = (viewsByDate[date] || 0) + views;
    });

    const dates = Object.keys(viewsByDate).sort();
    const viewsValues = dates.map(d => viewsByDate[d]);

    state.charts.conversions = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => d.split('-').reverse().slice(0, 2).join('/')),
            datasets: [{
                label: 'LP Views (Meta)',
                data: viewsValues,
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

    // Segment by Tag: Leads vs Clientes
    const counts = { 'Leads': 0, 'Clientes': 0, 'Outros': 0 };
    state.data.contacts.forEach(row => {
        const tag = (row['Tags'] || '').toLowerCase();
        if (tag.includes('lead')) counts['Leads']++;
        else if (tag.includes('cliente')) counts['Clientes']++;
        else counts['Outros']++;
    });

    state.charts.source = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#6366f1', '#14b8a6', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: 'Outfit', size: 11 } } }
            }
        }
    });
}

function updateTables(sectionId) {
    if (sectionId === 'meta-ads') {
        const tbody = document.querySelector('#table-meta tbody');
        if (!tbody) return;
        
        // Grouping by Campaign Name
        const campaigns = {};
        state.data.metaAds.forEach(row => {
            const name = row['Nome da campanha'] || 'Outras';
            if (!campaigns[name]) {
                campaigns[name] = { spend: 0, views: 0, clicks: 0, impressions: 0 };
            }
            campaigns[name].spend += parseFloat(row['Valor usado (BRL)']) || 0;
            campaigns[name].views += parseInt(row['Visualizações da página de destino do site']) || 0;
            campaigns[name].clicks += parseInt(row['Cliques no link']) || 0;
            campaigns[name].impressions += parseInt(row['Impressões']) || 0;
        });

        tbody.innerHTML = Object.entries(campaigns).map(([name, data]) => {
            const ctr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : '0.00';
            return `
                <tr>
                    <td>${name}</td>
                    <td>R$ ${data.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>${data.views.toLocaleString()}</td>
                    <td>${data.clicks.toLocaleString()}</td>
                    <td>${ctr}%</td>
                </tr>
            `;
        }).join('');

    } else if (sectionId === 'sympla') {
        const tbody = document.querySelector('#table-sympla tbody');
        if (!tbody) return;
        tbody.innerHTML = state.data.sympla.map(row => `
            <tr>
                <td>${row['ID_Pedido'] || '-'}</td>
                <td>${row['Status'] || '-'}</td>
                <td>R$ ${(row['Valor'] || 0).toLocaleString('pt-BR')}</td>
                <td>${row['Tipo_Ingresso'] || '-'}</td>
                <td>${row['Data_Compra'] || '-'}</td>
            </tr>
        `).join('');

    } else if (sectionId === 'email-perf') {
        const tbody = document.querySelector('#table-emails tbody');
        if (!tbody) return;
        
        // Identify Base Label from file name/content
        tbody.innerHTML = state.data.emailPerf.map(row => {
            const baseLabel = row['YouRH Summit Porto Alegre - BASE LEADS AGENDADOS RS'] ? "BASE LEADS RS" : "Outra Base";
            return `
                <tr>
                    <td>${baseLabel}</td>
                    <td>${row['Processados']}</td>
                    <td>${row['Abertos']}</td>
                    <td>${row['Bounce']}</td>
                    <td>${row['Taxa de abertura']}%</td>
                </tr>
            `;
        }).join('');

    } else if (sectionId === 'whatsapp') {
        const tbody = document.querySelector('#table-whatsapp tbody');
        if (!tbody) return;
        // Filter by WhatsApp channel
        const waContacts = state.data.contacts.filter(row => (row['Canal'] || '').toLowerCase().includes('whatsapp'));
        tbody.innerHTML = waContacts.slice(0, 50).map(row => `
            <tr>
                <td>${row['Cliente']}</td>
                <td>${row['Email']}</td>
                <td>${row['Tags']}</td>
                <td>${row['Registro em']}</td>
                <td>${row['Canal']}</td>
            </tr>
        `).join('');

    } else if (sectionId === 'contacts') {
        const tbody = document.querySelector('#table-contacts tbody');
        if (!tbody) return;
        tbody.innerHTML = state.data.contacts.slice(0, 50).map(row => `
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
